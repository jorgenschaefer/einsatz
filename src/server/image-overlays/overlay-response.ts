import type { Queryable } from "@/server/db/db";
import { getImageOverlay } from "./image-overlays";
import { overlayContentType, readOverlayFile } from "./image-storage";

/**
 * Liefert das Bild eines Bild-Overlays aus dem Uploads-Volume – nur, wenn es zu
 * `operationId` gehört, sonst 404. Mit `visibleOnly` (Token-Ansichten) ist auch
 * ein ausgeblendetes Overlay 404. Die Zugangsprüfung (Login bzw. Token) macht
 * die aufrufende Route vorher.
 */
export async function overlayImageResponse(
  db: Queryable,
  overlayId: string,
  operationId: string,
  { visibleOnly = false }: { visibleOnly?: boolean } = {},
): Promise<Response> {
  const overlay = await getImageOverlay(db, overlayId);
  if (
    !overlay ||
    overlay.operationId !== operationId ||
    (visibleOnly && !overlay.visible)
  )
    return new Response("Nicht gefunden", { status: 404 });
  const bytes = await readOverlayFile(overlay.filePath);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": overlayContentType(overlay.filePath),
      "Cache-Control": "private, no-store",
    },
  });
}
