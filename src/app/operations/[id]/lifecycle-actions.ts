"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { deleteOperation } from "@/server/operations/delete-operation";
import {
  closeOperation,
  reopenOperation,
} from "@/server/operations/operation-lifecycle";
import { revalidateOperation } from "./operation-action";

// Bespoke – nicht über `operationAction`: close/reopen revalidieren zusätzlich
// die Übersicht, delete leitet um statt zu revalidieren (siehe unten).
function revalidateStatusChange(operationId: string): void {
  revalidateOperation(operationId);
  revalidatePath("/operations"); // Statuswechsel auch in der Übersicht sichtbar machen
}

export async function closeOperationAction(operationId: string): Promise<void> {
  await requireUser();
  await closeOperation(getDb(), operationId);
  revalidateStatusChange(operationId);
}

export async function reopenOperationAction(
  operationId: string,
): Promise<void> {
  await requireUser();
  await reopenOperation(getDb(), operationId);
  revalidateStatusChange(operationId);
}

export async function deleteOperationAction(
  operationId: string,
): Promise<void> {
  await requireUser();
  // Eine Domänenfunktion kapselt DB-Löschung + Datei-Aufräumen (keine
  // Orchestrierung mehr in der Action).
  await deleteOperation(getDb(), operationId);
  publishOperationChanged(operationId); // andere Clients laden neu → Zugang/Ansicht endet
  redirect("/operations");
}
