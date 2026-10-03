"use server";

import type { ActionResult } from "@/app/action-result";
import type { SymbolComposition } from "@/map/composition";
import {
  createMapSymbol,
  deleteMapSymbol,
  generateDeviceLink,
  moveMapSymbol,
  removeDeviceLink,
  updateMapSymbolComposition,
} from "@/server/mapsymbols/map-symbols";
import { operationAction } from "./operation-action";

export async function placeMapSymbolAction(
  operationId: string,
  composition: SymbolComposition,
  lat: number,
  lng: number,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await createMapSymbol(db, { operationId, composition, lat, lng });
    return operationId;
  });
}

export async function moveMapSymbolAction(
  operationId: string,
  id: string,
  lat: number,
  lng: number,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await moveMapSymbol(db, operationId, id, lat, lng);
    return operationId;
  });
}

export async function updateMapSymbolCompositionAction(
  operationId: string,
  id: string,
  composition: SymbolComposition,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await updateMapSymbolComposition(db, operationId, id, composition);
    return operationId;
  });
}

export async function deleteMapSymbolAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await deleteMapSymbol(db, operationId, id);
    return operationId;
  });
}

export async function generateDeviceLinkAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await generateDeviceLink(db, operationId, id);
    return operationId;
  });
}

export async function removeDeviceLinkAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await removeDeviceLink(db, operationId, id);
    return operationId;
  });
}
