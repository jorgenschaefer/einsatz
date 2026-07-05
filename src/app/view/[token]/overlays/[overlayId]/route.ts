import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { getImageOverlay } from "@/server/image-overlays/image-overlays";
import {
  overlayContentType,
  readOverlayFile,
} from "@/server/image-overlays/image-storage";
import { resolveViewAccess } from "@/server/viewlinks/view-links";

/** Liefert das Bild eines Bild-Overlays für die login-freie Ansichtslink-Ansicht (token- und status-gebunden). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; overlayId: string }> },
) {
  const { token, overlayId } = await params;
  const db = getDb();
  const access = await resolveViewAccess(db, token);
  if (!access) return new NextResponse("Kein Zugang", { status: 403 });
  const overlay = await getImageOverlay(db, overlayId);
  if (!overlay || overlay.operationId !== access.operationId)
    return new NextResponse("Nicht gefunden", { status: 404 });
  const bytes = await readOverlayFile(overlay.filePath);
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": overlayContentType(overlay.filePath),
      "Cache-Control": "private, no-store",
    },
  });
}
