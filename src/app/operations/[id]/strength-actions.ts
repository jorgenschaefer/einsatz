"use server";

import { createStation, renameStation } from "@/server/strength/stations";
import { type ActionResult, operationAction } from "./operation-action";

export async function createStationAction(
  operationId: string,
  name: string,
): Promise<ActionResult> {
  return operationAction(async (db, user) => {
    await createStation(db, { operationId, name, author: user.username });
    return operationId;
  });
}

export async function renameStationAction(
  stationId: string,
  name: string,
): Promise<ActionResult> {
  return operationAction((db, user) =>
    renameStation(db, { stationId, name, author: user.username }),
  );
}
