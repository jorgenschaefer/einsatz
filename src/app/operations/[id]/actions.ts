"use server";

import type { MapView } from "@/map/view";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { setDefaultView } from "@/server/operations/operations";

export async function setDefaultViewAction(
  operationId: string,
  view: MapView,
): Promise<void> {
  await requireUser();
  await setDefaultView(getDb(), operationId, view);
}
