"use server";

import type { AreaGeometry, AreaStyle } from "@/map/area";
import {
  createArea,
  deleteArea,
  updateAreaGeometry,
  updateAreaStyle,
} from "@/server/areas/areas";
import { type ActionResult, operationAction } from "./operation-action";

// Zugehörigkeit (flaches Trust-Modell): Diese Kind-Objekt-Actions mutieren über
// die vom Client gelieferte Objekt-`id`, ohne zu prüfen, dass das Objekt zu
// `operationId` gehört (`operationId` dient hier nur Revalidate/Live-Event). Das
// ist bewusst unkritisch, solange jeder angemeldete Nutzer jeden Einsatz
// bearbeiten darf; es ist zugleich der Ansatzpunkt für eine künftige
// Per-Einsatz-Autorisierung: dann hier vor der Mutation die Zugehörigkeit prüfen.
const DEFAULT_AREA_STYLE: AreaStyle = {
  color: "#e2001a",
  opacity: 0.4,
  label: "",
};

export async function createAreaAction(
  operationId: string,
  geometry: AreaGeometry,
): Promise<ActionResult & { id?: string }> {
  let id: string | undefined;
  const result = await operationAction(async (db) => {
    ({ id } = await createArea(db, {
      operationId,
      geometry,
      ...DEFAULT_AREA_STYLE,
    }));
    return operationId;
  });
  return { ...result, id };
}

export async function updateAreaStyleAction(
  operationId: string,
  id: string,
  style: AreaStyle,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await updateAreaStyle(db, id, style);
    return operationId;
  });
}

export async function updateAreaGeometryAction(
  operationId: string,
  id: string,
  geometry: AreaGeometry,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await updateAreaGeometry(db, id, geometry);
    return operationId;
  });
}

export async function deleteAreaAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await deleteArea(db, id);
    return operationId;
  });
}
