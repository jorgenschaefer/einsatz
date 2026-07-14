"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { createViewLink, deleteViewLink } from "@/server/viewlinks/view-links";

// Zugehörigkeit (flaches Trust-Modell): Diese Kind-Objekt-Actions mutieren über
// die vom Client gelieferte Objekt-`id`, ohne zu prüfen, dass das Objekt zu
// `operationId` gehört (`operationId` dient hier nur Revalidate/Live-Event). Das
// ist bewusst unkritisch, solange jeder angemeldete Nutzer jeden Einsatz
// bearbeiten darf; es ist zugleich der Ansatzpunkt für eine künftige
// Per-Einsatz-Autorisierung: dann hier vor der Mutation die Zugehörigkeit prüfen.
// (view-link-Actions bleiben bewusst außerhalb von `operationAction`: sie
// revalidieren nur die Einsatzseite, ohne Live-Event.)
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
