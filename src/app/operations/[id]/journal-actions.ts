"use server";

import type { ActionResult } from "@/app/action-result";
import type { EntryContent } from "@/journal/entry-route";
import {
  annulEntry,
  appendEntry,
  correctEntry,
} from "@/server/journal/journal";
import { operationAction } from "./operation-action";

export async function addJournalEntryAction(
  operationId: string,
  { text, ...route }: EntryContent,
): Promise<ActionResult> {
  return operationAction(async (db, user) => {
    // Die Leer-Prüfung liegt in der Domäne (appendEntry), nicht hier.
    await db.transaction((tx) =>
      appendEntry(tx, {
        operationId,
        text,
        type: "manuell",
        author: user.username,
        route,
      }),
    );
    return operationId;
  });
}

export async function correctEntryAction(
  entryId: string,
  content: EntryContent,
): Promise<ActionResult> {
  return operationAction(async (db, user) => {
    const entry = await correctEntry(db, entryId, content, user.username);
    return entry.operationId;
  });
}

export async function annulEntryAction(entryId: string): Promise<ActionResult> {
  return operationAction(async (db) => {
    const entry = await annulEntry(db, entryId);
    return entry.operationId;
  });
}
