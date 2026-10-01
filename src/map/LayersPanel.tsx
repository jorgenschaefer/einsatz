"use client";

import { Stack, Text } from "@mantine/core";
import type { ActionResult } from "@/app/action-result";
import { ImageOverlayEditor } from "./ImageOverlayEditor";
import { ImageOverlayPanel } from "./ImageOverlayPanel";
import { KmlPanel } from "./KmlPanel";
import type {
  WorkspaceImageOverlay,
  WorkspaceKmlOverlay,
} from "./SituationWorkspace";
import type { ImageOverlayEditing } from "./useImageOverlayEditing";

/** Das Ebenen-Panel der Lagekarte: KML-Ebenen und Bild-Overlays. */
export function LayersPanel({
  kmlOverlays,
  onAddKmlFile,
  onAddKmlUrl,
  onSetKmlVisibility,
  onReloadKml,
  onRemoveKml,
  imageOverlays,
  editingImageId,
  onAddImage,
  onSetImageVisibility,
  onEditImage,
  imageEditing,
  onEndMode,
}: {
  kmlOverlays: WorkspaceKmlOverlay[];
  onAddKmlFile: (name: string, content: string) => Promise<ActionResult>;
  onAddKmlUrl: (name: string, url: string) => Promise<ActionResult>;
  onSetKmlVisibility: (id: string, visible: boolean) => Promise<ActionResult>;
  onReloadKml: (id: string) => Promise<ActionResult>;
  onRemoveKml: (id: string) => Promise<ActionResult>;
  imageOverlays: WorkspaceImageOverlay[];
  editingImageId: string | null;
  onAddImage: (file: File) => Promise<ActionResult>;
  onSetImageVisibility: (id: string, visible: boolean) => Promise<ActionResult>;
  onEditImage: (id: string) => void;
  /** Ohne `startEditImage`: das Starten kommt als `onEditImage`, das auch das Blatt schließt. */
  imageEditing: Pick<
    ImageOverlayEditing,
    | "editingImage"
    | "busy"
    | "error"
    | "changeImageOpacity"
    | "replaceImage"
    | "deleteImage"
  >;
  /** „Fertig" im Editor: beendet das Bearbeiten wie jeden Karten-Modus. */
  onEndMode: () => void;
}) {
  const { editingImage } = imageEditing;
  return (
    <Stack>
      <KmlPanel
        overlays={kmlOverlays}
        onAddFile={onAddKmlFile}
        onAddUrl={onAddKmlUrl}
        onToggleVisibility={onSetKmlVisibility}
        onReload={onReloadKml}
        onRemove={onRemoveKml}
      />
      <Stack
        component="section"
        aria-labelledby="image-overlay-heading"
        gap="xs"
      >
        <Text id="image-overlay-heading" fw={600} size="sm">
          Bild-Overlays
        </Text>
        <ImageOverlayPanel
          overlays={imageOverlays}
          editingId={editingImageId}
          onAdd={onAddImage}
          onToggleVisibility={onSetImageVisibility}
          onEdit={onEditImage}
          renderEditor={() =>
            editingImage && (
              <ImageOverlayEditor
                opacity={editingImage.placement.opacity}
                onOpacityChange={imageEditing.changeImageOpacity}
                onReplace={imageEditing.replaceImage}
                onDelete={() => imageEditing.deleteImage(editingImage.id)}
                onDone={onEndMode}
                busy={imageEditing.busy}
                error={imageEditing.error}
              />
            )
          }
        />
      </Stack>
    </Stack>
  );
}
