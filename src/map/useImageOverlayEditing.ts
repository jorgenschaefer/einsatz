"use client";

import type { ActionResult } from "@/app/action-result";
import { useActionRunner } from "@/app/useActionRunner";
import { useNotifyingActionRunner } from "@/app/useNotifyingActionRunner";
import type { ImagePlacement } from "./image-overlay";
import { IMAGE_OVERLAYS } from "./notification-sources";
import type { WorkspaceImageOverlay } from "./SituationWorkspace";
import type { MapModeControls } from "./useMapMode";

/**
 * Das Bearbeiten eines Bild-Overlays: Platzierung, Deckkraft, Ersetzen und
 * Löschen, mit Fortschritt und Fehler fürs Panel. Der Fehler gehört zu einem
 * Bearbeiten: Jedes neue beginnt ohne ihn. Scheitert eine Platzierung auf der
 * Karte, meldet das die Benachrichtigung „Bild-Overlays“, und das Bild springt
 * auf die gespeicherte Platzierung zurück.
 */
export function useImageOverlayEditing({
  imageOverlays,
  mode,
  onUpdateImagePlacement,
  onReplaceImage,
  onDeleteImage,
  restoreImagePlacement,
}: {
  imageOverlays: WorkspaceImageOverlay[];
  mode: Pick<MapModeControls, "editingImageId" | "armImageEdit" | "reset">;
  onUpdateImagePlacement: (
    id: string,
    placement: ImagePlacement,
  ) => Promise<ActionResult>;
  onReplaceImage: (id: string, file: File) => Promise<ActionResult>;
  onDeleteImage: (id: string) => Promise<ActionResult>;
  /** Puts the image and its handles on the map back on the saved placement. */
  restoreImagePlacement: (id: string) => void;
}) {
  const { editingImageId } = mode;
  const { busy, error, setError, run: persistImage } = useActionRunner();
  // Speichern einer Platzierung meldet über die Benachrichtigung „Bild-Overlays“;
  // jede andere Aktion des Editors schließt sie beim Start.
  const {
    busy: savingPlacement,
    run: runPlacementSave,
    closeError: closeImageOverlaysError,
  } = useNotifyingActionRunner(IMAGE_OVERLAYS);
  const editingImage =
    imageOverlays.find((o) => o.id === editingImageId) ?? null;

  const startEditImage = (id: string) => {
    setError(null);
    mode.armImageEdit(id);
  };
  // Platzierungs-/Deckkraft-/Ersetzen-Änderungen speichern, ohne den
  // Bearbeiten-Modus zu verlassen (nur „Fertig"/„Löschen" beenden ihn).
  const saveImagePlacement = async (id: string, placement: ImagePlacement) => {
    setError(null);
    const result = await runPlacementSave(() =>
      onUpdateImagePlacement(id, placement),
    );
    if (result?.error) restoreImagePlacement(id);
  };
  const changeImageOpacity = (opacity: number) => {
    if (!editingImage) return;
    closeImageOverlaysError();
    void persistImage(() =>
      onUpdateImagePlacement(editingImage.id, {
        ...editingImage.placement,
        opacity,
      }),
    );
  };
  const replaceImage = (file: File) => {
    if (!editingImageId) return;
    closeImageOverlaysError();
    void persistImage(() => onReplaceImage(editingImageId, file));
  };
  const deleteImage = async (id: string) => {
    closeImageOverlaysError();
    const result = await onDeleteImage(id);
    if (!result.error) mode.reset();
    return result;
  };
  const finishEdit = () => {
    closeImageOverlaysError();
    mode.reset();
  };

  return {
    editingImage,
    busy: busy || savingPlacement,
    error,
    startEditImage,
    saveImagePlacement,
    changeImageOpacity,
    replaceImage,
    deleteImage,
    finishEdit,
  };
}

export type ImageOverlayEditing = ReturnType<typeof useImageOverlayEditing>;
