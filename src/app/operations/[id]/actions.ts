"use server";

import type { MapView } from "@/map/view";
import { setDefaultView } from "@/server/operations/operations";
import { type ActionResult, operationAction } from "./operation-action";

export async function setDefaultViewAction(
  operationId: string,
  view: MapView,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await setDefaultView(db, operationId, view);
    return operationId;
  });
}
