import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { overlayImageResponse } from "@/server/image-overlays/overlay-response";
import { resolveDeviceAccess } from "@/server/mapsymbols/map-symbols";

/** Liefert das Bild eines Bild-Overlays für die login-freie Geräteansicht (token- und status-gebunden). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; overlayId: string }> },
) {
  const { token, overlayId } = await params;
  const db = getDb();
  const access = await resolveDeviceAccess(db, token);
  if (!access) return new NextResponse("Kein Zugang", { status: 403 });
  return overlayImageResponse(db, overlayId, access.operationId, {
    visibleOnly: true,
  });
}
