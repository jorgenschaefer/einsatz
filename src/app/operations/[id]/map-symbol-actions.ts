"use server";

import { revalidatePath } from "next/cache";
import type { SymbolComposition } from "@/map/composition";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import {
  createMapSymbol,
  deleteMapSymbol,
  generateDeviceLink,
  moveMapSymbol,
  updateMapSymbolComposition,
} from "@/server/mapsymbols/map-symbols";

const revalidate = (operationId: string) => {
  revalidatePath(`/operations/${operationId}`);
  publishOperationChanged(operationId);
};

export async function placeMapSymbolAction(
  operationId: string,
  composition: SymbolComposition,
  lat: number,
  lng: number,
): Promise<void> {
  await requireUser();
  await createMapSymbol(getDb(), { operationId, composition, lat, lng });
  revalidate(operationId);
}

export async function moveMapSymbolAction(
  operationId: string,
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  await requireUser();
  await moveMapSymbol(getDb(), id, lat, lng);
  revalidate(operationId);
}

export async function updateMapSymbolCompositionAction(
  operationId: string,
  id: string,
  composition: SymbolComposition,
): Promise<void> {
  await requireUser();
  await updateMapSymbolComposition(getDb(), id, composition);
  revalidate(operationId);
}

export async function deleteMapSymbolAction(
  operationId: string,
  id: string,
): Promise<void> {
  await requireUser();
  await deleteMapSymbol(getDb(), id);
  revalidate(operationId);
}

export async function generateDeviceLinkAction(
  operationId: string,
  id: string,
): Promise<void> {
  await requireUser();
  await generateDeviceLink(getDb(), id);
  revalidate(operationId);
}
