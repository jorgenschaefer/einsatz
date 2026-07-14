"use server";

import type { SymbolComposition } from "@/map/composition";
import {
  createMapSymbol,
  deleteMapSymbol,
  generateDeviceLink,
  moveMapSymbol,
  updateMapSymbolComposition,
} from "@/server/mapsymbols/map-symbols";
import { type ActionResult, operationAction } from "./operation-action";

// Kind-Objekt-Aktionen (auch Journal, Bereiche, Overlays) wirken allein auf
// die Objekt-`id`; `operationId` dient hier nur dem revalidatePath und dem
// Live-Event. Unter der aktuellen flachen Berechtigung unkritisch – würde aber
// zu IDOR, sobald eine pro-Einsatz-Autorisierung eingeführt wird (dann die
// Zugehörigkeit des Objekts zum Einsatz vor der Mutation prüfen).
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
    await moveMapSymbol(db, id, lat, lng);
    return operationId;
  });
}

export async function updateMapSymbolCompositionAction(
  operationId: string,
  id: string,
  composition: SymbolComposition,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await updateMapSymbolComposition(db, id, composition);
    return operationId;
  });
}

export async function deleteMapSymbolAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await deleteMapSymbol(db, id);
    return operationId;
  });
}

export async function generateDeviceLinkAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await generateDeviceLink(db, id);
    return operationId;
  });
}
