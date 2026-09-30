"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { createViewLink, deleteViewLink } from "@/server/viewlinks/view-links";
import { type ActionResult, operationAction } from "./operation-action";

// Bewusst außerhalb von `operationAction`: Das Erzeugen revalidiert nur die
// Einsatzseite, ohne Live-Event. Zur Objekt-Zugehörigkeit (flaches
// Trust-Modell) siehe `operationAction`.
export async function createViewLinkAction(
  operationId: string,
  label: string,
): Promise<void> {
  await requireUser();
  await createViewLink(getDb(), { operationId, label });
  revalidatePath(`/operations/${operationId}`);
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
