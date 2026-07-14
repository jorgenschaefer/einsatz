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

// Zugehörigkeit (flaches Trust-Modell): Diese Kind-Objekt-Actions mutieren über
// die vom Client gelieferte Objekt-`id`, ohne zu prüfen, dass das Objekt zu
// `operationId` gehört (`operationId` dient hier nur Revalidate/Live-Event). Das
// ist bewusst unkritisch, solange jeder angemeldete Nutzer jeden Einsatz
// bearbeiten darf; es ist zugleich der Ansatzpunkt für eine künftige
// Per-Einsatz-Autorisierung: dann hier vor der Mutation die Zugehörigkeit prüfen.
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
