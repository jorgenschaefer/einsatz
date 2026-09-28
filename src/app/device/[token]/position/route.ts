import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { reportPosition } from "@/server/mapsymbols/map-symbols";
import { isValidLatLng } from "@/server/validation";

/**
 * Standortmeldung eines Geräts über seinen Gerätelink. Ohne Login; nur gültig,
 * solange Token und Einsatz-Status es zulassen (sonst 403, grundunabhängig).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Ungültige Daten", { status: 400 });
  }
  const { lat, lng } = (body ?? {}) as { lat?: unknown; lng?: unknown };
  if (!isValidLatLng(lat, lng)) {
    return new NextResponse("Ungültige Daten", { status: 400 });
  }
  // isValidLatLng hat lat/lng als endliche Zahlen in Grenzen bestätigt.
  const access = await reportPosition(
    getDb(),
    token,
    lat as number,
    lng as number,
  );
  if (!access) return new NextResponse(null, { status: 403 });
  publishOperationChanged(access.operationId); // StandortGemeldet an alle Clients
  return new NextResponse(null, { status: 204 });
}
