import { addImageOverlay } from "@/server/image-overlays/image-overlay-uploads";
import {
  formFile,
  formJson,
  handleUpload,
  IMAGE_UPLOAD_MESSAGES,
} from "../upload-route";

/** Bindet eine PDF-/PNG-Datei als Bild-Overlay ein: `file`, `view` (JSON). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: operationId } = await params;
  return handleUpload(request, IMAGE_UPLOAD_MESSAGES, async (db, form) => {
    await addImageOverlay(db, {
      operationId,
      file: formFile(form),
      view: formJson(form, "view"),
    });
    return operationId;
  });
}
