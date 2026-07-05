"use server";

import { requireUser } from "@/server/auth/current-user";
import { geocodeQuery } from "@/server/geocoder/geocode-service";
import type { GeoHit } from "@/server/geocoder/geocoder";

export async function geocodeAddressAction(query: string): Promise<GeoHit[]> {
  await requireUser();
  return geocodeQuery(query);
}
