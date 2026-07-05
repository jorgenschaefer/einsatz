"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { createViewLink, deleteViewLink } from "@/server/viewlinks/view-links";

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
