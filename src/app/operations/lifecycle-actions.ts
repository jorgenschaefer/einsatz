"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/action-result";
import { requireAdmin } from "@/server/auth/current-user";
import type { Db } from "@/server/db/db";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { deleteOperation } from "@/server/operations/delete-operation";
import {
  closeOperation,
  reopenOperation,
} from "@/server/operations/operation-lifecycle";
import { ValidationError } from "@/server/validation";
import { operationAction } from "./[id]/operation-action";

export async function closeOperationAction(
  operationId: string,
): Promise<ActionResult> {
  return changeStatus(operationId, closeOperation);
}

export async function reopenOperationAction(
  operationId: string,
): Promise<ActionResult> {
  return changeStatus(operationId, reopenOperation);
}

// Erfolg leitet um. Ein laufender Einsatz bleibt stehen und meldet das; die
// Übersicht zeigte ihn noch als abgeschlossen und wird neu geladen. Ein
// unerwarteter Fehler fliegt als Ausnahme weiter und erscheint in der
// Rückfrage als allgemeine Meldung.
export async function deleteOperationAction(
  operationId: string,
): Promise<ActionResult> {
  await requireAdmin();
  let deleted: boolean;
  try {
    deleted = await deleteOperation(getDb(), operationId);
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
  if (!deleted) {
    revalidatePath("/operations");
    return { error: "Nur ein abgeschlossener Einsatz lässt sich löschen." };
  }
  publishOperationChanged(operationId); // andere Clients laden neu → Zugang/Ansicht endet
  redirect("/operations");
}

// Wie jede Einsatz-Action, nur zeigt auch die Übersicht den neuen Status.
async function changeStatus(
  operationId: string,
  change: (db: Db, operationId: string) => Promise<void>,
): Promise<ActionResult> {
  const result = await operationAction(async (db) => {
    await change(db, operationId);
    return operationId;
  });
  if (!result.error) revalidatePath("/operations");
  return result;
}
