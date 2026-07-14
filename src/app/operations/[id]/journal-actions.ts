"use server";

import {
  annulEntry,
  appendEntry,
  correctEntry,
} from "@/server/journal/journal";
import { ValidationError } from "@/server/validation";
import { type ActionResult, operationAction } from "./operation-action";

export async function addJournalEntryAction(
  operationId: string,
  text: string,
): Promise<ActionResult> {
  return operationAction(async (db, user) => {
    const trimmed = text.trim();
    if (!trimmed) throw new ValidationError("Der Text darf nicht leer sein.");
    await db.transaction((tx) =>
      appendEntry(tx, {
        operationId,
        text: trimmed,
        type: "manuell",
        author: user.username,
      }),
    );
    return operationId;
  });
}

export async function correctEntryAction(
  entryId: string,
  text: string,
): Promise<ActionResult> {
  return operationAction(async (db, user) => {
    const entry = await correctEntry(db, entryId, text, user.username);
    return entry.operationId;
  });
}

export async function annulEntryAction(entryId: string): Promise<ActionResult> {
  return operationAction(async (db) => {
    const entry = await annulEntry(db, entryId);
    return entry.operationId;
  });
}
