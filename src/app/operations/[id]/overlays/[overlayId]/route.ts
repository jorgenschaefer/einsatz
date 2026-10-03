import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { replaceImageOverlayImage } from "@/server/image-overlays/image-overlay-uploads";
import { overlayImageResponse } from "@/server/image-overlays/overlay-response";
import {
  formFile,
  handleUpload,
  IMAGE_UPLOAD_MESSAGES,
} from "../../upload-route";

/** Liefert das gerenderte Bild eines Bild-Overlays aus dem Docker-Volume. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; overlayId: string }> },
) {
  await requireUser();
  const { id, overlayId } = await params;
  return overlayImageResponse(getDb(), overlayId, id);
}

/** Ersetzt die Datei eines Bild-Overlays des Einsatzes `id`: `file`. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; overlayId: string }> },
) {
  const { id, overlayId } = await params;
  return handleUpload(request, IMAGE_UPLOAD_MESSAGES, async (db, form) => {
    await replaceImageOverlayImage(db, {
      operationId: id,
      overlayId,
      file: formFile(form),
    });
    return id;
  });
}
