"use server";

import type { ActionResult } from "@/app/action-result";
import type { AreaGeometry, AreaStyle } from "@/map/area";
import {
  createArea,
  deleteArea,
  updateAreaGeometry,
  updateAreaStyle,
} from "@/server/areas/areas";
import { operationAction } from "./operation-action";

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
    await updateAreaStyle(db, operationId, id, style);
    return operationId;
  });
}

export async function updateAreaGeometryAction(
  operationId: string,
  id: string,
  geometry: AreaGeometry,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await updateAreaGeometry(db, operationId, id, geometry);
    return operationId;
  });
}

export async function deleteAreaAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await deleteArea(db, operationId, id);
    return operationId;
  });
}
