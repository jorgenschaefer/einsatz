import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { geocodeQueryForTokenLink } from "@/server/geocoder/geocode-service";
import { resolveDeviceAccess } from "@/server/mapsymbols/map-symbols";

/** Adress-Suche für die read-only Geräteansicht; token- und status-gebunden wie der Zugang. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await resolveDeviceAccess(getDb(), token);
  if (!access) return new NextResponse("Kein Zugang", { status: 403 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await geocodeQueryForTokenLink(q));
}
