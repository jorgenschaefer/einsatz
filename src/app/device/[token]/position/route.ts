import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { BodyTooLargeError, readBody } from "@/server/http/read-body";
import { reportPosition } from "@/server/mapsymbols/map-symbols";
import { isValidLatLng } from "@/server/validation";

/** `{"lat":…,"lng":…}` braucht keine 100 Bytes; mehr nimmt die Route nicht an. */
const MAX_BODY_BYTES = 1024;

/**
 * Standortmeldung eines Geräts über seinen Gerätelink. Ohne Login; nur gültig,
 * solange Token und Einsatz-Status es zulassen (sonst 403, grundunabhängig).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  let bytes: Uint8Array;
  try {
    bytes = await readBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return new NextResponse("Standortmeldung zu groß", { status: 413 });
    }
    // Abgebrochene Übertragung, typisch bei schlechtem Netz am Gerät.
    return new NextResponse("Ungültige Daten", { status: 400 });
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return new NextResponse("Ungültige Daten", { status: 400 });
  }
  const { lat, lng } = (body ?? {}) as { lat?: unknown; lng?: unknown };
  if (!isValidLatLng(lat, lng)) {
    return new NextResponse("Ungültige Daten", { status: 400 });
  }
  const { token } = await params;
  // isValidLatLng hat lat/lng als endliche Zahlen in Grenzen bestätigt.
  const access = await reportPosition(
    getDb(),
    token,
    lat as number,
    lng as number,
  );
  if (!access) return new NextResponse(null, { status: 403 });
  // Eine gedrosselte Meldung ist für das Gerät kein Fehler, ändert aber nichts.
  if (access.stored) publishOperationChanged(access.operationId); // StandortGemeldet an alle Clients
  return new NextResponse(null, { status: 204 });
}
