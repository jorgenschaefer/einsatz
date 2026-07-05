"use server";

import { revalidatePath } from "next/cache";
import type { AreaGeometry, AreaStyle } from "@/map/area";
import {
  createArea,
  deleteArea,
  updateAreaGeometry,
  updateAreaStyle,
} from "@/server/areas/areas";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";

// Kind-Objekt-Aktionen (auch Journal, Kartenzeichen, Overlays) wirken allein auf
// die Objekt-`id`; `operationId` dient hier nur dem revalidatePath und dem
// Live-Event. Unter der aktuellen flachen Berechtigung unkritisch – würde aber
// zu IDOR, sobald eine pro-Einsatz-Autorisierung eingeführt wird (dann die
// Zugehörigkeit des Objekts zum Einsatz vor der Mutation prüfen).
const DEFAULT_AREA_STYLE: AreaStyle = {
  color: "#e2001a",
  opacity: 0.4,
  label: "",
};
const revalidate = (operationId: string) => {
  revalidatePath(`/operations/${operationId}`);
  publishOperationChanged(operationId);
};

export async function createAreaAction(
  operationId: string,
  geometry: AreaGeometry,
): Promise<void> {
  await requireUser();
  await createArea(getDb(), { operationId, geometry, ...DEFAULT_AREA_STYLE });
  revalidate(operationId);
}

export async function updateAreaStyleAction(
  operationId: string,
  id: string,
  style: AreaStyle,
): Promise<void> {
  await requireUser();
  await updateAreaStyle(getDb(), id, style);
  revalidate(operationId);
}

export async function updateAreaGeometryAction(
  operationId: string,
  id: string,
  geometry: AreaGeometry,
): Promise<void> {
  await requireUser();
  await updateAreaGeometry(getDb(), id, geometry);
  revalidate(operationId);
}

export async function deleteAreaAction(
  operationId: string,
  id: string,
): Promise<void> {
  await requireUser();
  await deleteArea(getDb(), id);
  revalidate(operationId);
}
