"use server";

import type { ActionResult } from "@/app/action-result";
import { createViewLink, deleteViewLink } from "@/server/viewlinks/view-links";
import { operationAction } from "./operation-action";

// Zur Objekt-Zugehörigkeit (flaches Trust-Modell) siehe `operationAction`.
export async function createViewLinkAction(
  operationId: string,
  label: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await createViewLink(db, { operationId, label });
    return operationId;
  });
}

export async function deleteViewLinkAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await deleteViewLink(db, id);
    return operationId;
  });
}
