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
  const db = getDb();
  // isValidLatLng hat lat/lng als endliche Zahlen in Grenzen bestätigt.
  const { result, operationId } = await reportPosition(
    db,
    token,
    lat as number,
    lng as number,
  );
  // operationId kommt direkt aus reportPosition – keine zweite Abfrage nötig.
  if (result === "ok" && operationId) {
    publishOperationChanged(operationId); // StandortGemeldet an alle Clients
  }
  return new NextResponse(null, { status: result === "ok" ? 204 : 403 });
}
