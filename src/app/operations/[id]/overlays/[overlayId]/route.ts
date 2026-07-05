import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { getImageOverlay } from "@/server/image-overlays/image-overlays";
import {
  overlayContentType,
  readOverlayFile,
} from "@/server/image-overlays/image-storage";

/** Liefert das gerenderte Bild eines Bild-Overlays aus dem Docker-Volume. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; overlayId: string }> },
) {
  await requireUser();
  const { id, overlayId } = await params;
  const overlay = await getImageOverlay(getDb(), overlayId);
  if (!overlay || overlay.operationId !== id)
    return new NextResponse("Nicht gefunden", { status: 404 });
  const bytes = await readOverlayFile(overlay.filePath);
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": overlayContentType(overlay.filePath),
      "Cache-Control": "private, no-store",
    },
  });
}
