"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { listImageOverlays } from "@/server/image-overlays/image-overlays";
import { deleteOverlayFiles } from "@/server/image-overlays/image-storage";
import {
  closeOperation,
  reopenOperation,
} from "@/server/operations/operation-lifecycle";
import { deleteOperation } from "@/server/operations/operations";

const revalidate = (operationId: string) => {
  revalidatePath(`/operations/${operationId}`);
  revalidatePath("/operations"); // Statuswechsel auch in der Übersicht sichtbar machen
  publishOperationChanged(operationId);
};

export async function closeOperationAction(operationId: string): Promise<void> {
  await requireUser();
  await closeOperation(getDb(), operationId);
  revalidate(operationId);
}

export async function reopenOperationAction(
  operationId: string,
): Promise<void> {
  await requireUser();
  await reopenOperation(getDb(), operationId);
  revalidate(operationId);
}

export async function deleteOperationAction(
  operationId: string,
): Promise<void> {
  await requireUser();
  const db = getDb();
  const files = (await listImageOverlays(db, operationId)).map(
    (o) => o.filePath,
  );
  await deleteOperation(db, operationId); // Kartenobjekte/ETB kaskadieren in der DB
  await deleteOverlayFiles(files); // die zugehörigen Bilddateien aus dem Volume entfernen
  publishOperationChanged(operationId); // andere Clients laden neu → Zugang/Ansicht endet
  redirect("/operations");
}
