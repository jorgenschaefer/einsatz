import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { geocodeQuery } from "@/server/geocoder/geocode-service";
import { resolveViewAccess } from "@/server/viewlinks/view-links";

/** Adress-Suche für die read-only Ansichtslink-Ansicht; token- und status-gebunden wie der Zugang. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await resolveViewAccess(getDb(), token);
  if (!access) return new NextResponse("Kein Zugang", { status: 403 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await geocodeQuery(q));
}
