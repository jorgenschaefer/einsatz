import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { overlayImageResponse } from "@/server/image-overlays/overlay-response";

/** Liefert das gerenderte Bild eines Bild-Overlays aus dem Docker-Volume. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; overlayId: string }> },
) {
  await requireUser();
  const { id, overlayId } = await params;
  return overlayImageResponse(getDb(), overlayId, id);
}
