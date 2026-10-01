"use client";

import type { ActionResult } from "@/app/action-result";
import { useActionRunner } from "@/app/useActionRunner";
import type { ImagePlacement } from "./image-overlay";
import type { WorkspaceImageOverlay } from "./SituationWorkspace";
import type { MapModeControls } from "./useMapMode";

/**
 * Das Bearbeiten eines Bild-Overlays: Platzierung, Deckkraft, Ersetzen und
 * Löschen, mit Fortschritt und Fehler fürs Panel. Der Fehler gehört zu einem
 * Bearbeiten: Jedes neue beginnt ohne ihn.
 */
export function useImageOverlayEditing({
  imageOverlays,
  mode,
  onUpdateImagePlacement,
  onReplaceImage,
  onDeleteImage,
}: {
  imageOverlays: WorkspaceImageOverlay[];
  mode: Pick<MapModeControls, "editingImageId" | "armImageEdit" | "reset">;
  onUpdateImagePlacement: (
    id: string,
    placement: ImagePlacement,
  ) => Promise<ActionResult>;
  onReplaceImage: (id: string, file: File) => Promise<ActionResult>;
  onDeleteImage: (id: string) => Promise<ActionResult>;
}) {
  const { editingImageId } = mode;
  const { busy, error, setError, run: persistImage } = useActionRunner();
  const editingImage =
    imageOverlays.find((o) => o.id === editingImageId) ?? null;

  const startEditImage = (id: string) => {
    setError(null);
    mode.armImageEdit(id);
  };
  // Platzierungs-/Deckkraft-/Ersetzen-Änderungen speichern, ohne den
  // Bearbeiten-Modus zu verlassen (nur „Fertig"/„Löschen" beenden ihn).
  const saveImagePlacement = (id: string, placement: ImagePlacement) =>
    persistImage(() => onUpdateImagePlacement(id, placement));
  const changeImageOpacity = (opacity: number) => {
    if (!editingImage) return;
    void persistImage(() =>
      onUpdateImagePlacement(editingImage.id, {
        ...editingImage.placement,
        opacity,
      }),
    );
  };
  const replaceImage = (file: File) => {
    if (!editingImageId) return;
    void persistImage(() => onReplaceImage(editingImageId, file));
  };
  const deleteImage = async (id: string) => {
    const result = await onDeleteImage(id);
    if (!result.error) mode.reset();
    return result;
  };

  return {
    editingImage,
    busy,
    error,
    startEditImage,
    saveImagePlacement,
    changeImageOpacity,
    replaceImage,
    deleteImage,
  };
}

export type ImageOverlayEditing = ReturnType<typeof useImageOverlayEditing>;
