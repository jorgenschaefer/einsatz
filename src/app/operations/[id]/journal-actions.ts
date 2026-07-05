"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import {
  annulEntry,
  appendEntry,
  correctEntry,
} from "@/server/journal/journal";
import { ValidationError } from "@/server/validation";

const revalidate = (operationId: string) => {
  revalidatePath(`/operations/${operationId}`);
  publishOperationChanged(operationId);
};

export async function addJournalEntryAction(
  operationId: string,
  text: string,
): Promise<void> {
  const user = await requireUser();
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("Der Text darf nicht leer sein.");

  const db = getDb();
  await db.transaction((tx) =>
    appendEntry(tx, {
      operationId,
      text: trimmed,
      type: "manuell",
      author: user.username,
    }),
  );
  revalidate(operationId);
}

export async function correctEntryAction(
  entryId: string,
  text: string,
): Promise<void> {
  const user = await requireUser();
  const entry = await correctEntry(getDb(), entryId, text, user.username);
  revalidate(entry.operationId);
}

export async function annulEntryAction(entryId: string): Promise<void> {
  await requireUser();
  const entry = await annulEntry(getDb(), entryId);
  revalidate(entry.operationId);
}
