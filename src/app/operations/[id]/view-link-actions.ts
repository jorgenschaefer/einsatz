"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { createViewLink, deleteViewLink } from "@/server/viewlinks/view-links";

// Bewusst außerhalb von `operationAction`: Ansichtslinks revalidieren nur die
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
): Promise<void> {
  await requireUser();
  await deleteViewLink(getDb(), id);
  revalidatePath(`/operations/${operationId}`);
}
