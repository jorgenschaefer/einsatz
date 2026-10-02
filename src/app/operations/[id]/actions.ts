"use server";

import type { ActionResult } from "@/app/action-result";
import type { MapView } from "@/map/view";
import { setDefaultView } from "@/server/operations/operations";
import { operationAction } from "./operation-action";

export async function setDefaultViewAction(
  operationId: string,
  view: MapView,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await setDefaultView(db, operationId, view);
    return operationId;
  });
}
