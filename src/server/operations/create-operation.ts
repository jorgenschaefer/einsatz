import { NO_ROUTE } from "@/journal/entry-route";
import type { Db } from "@/server/db/db";
import { appendEntry } from "@/server/journal/journal";
import { ValidationError } from "@/server/validation";
import { insertOperation, type Operation } from "./operations";

/** Automatischer ETB-Eintrag, der beim Eröffnen eines Einsatzes entsteht. */
export const OPERATION_OPENED_ENTRY_TEXT = "Einsatz eröffnet";

/**
 * Eröffnet einen Einsatz: validiert die Bezeichnung, legt den Einsatz an und
 * schreibt atomar den automatischen ETB-Eröffnungseintrag.
 */
export async function createOperation(
  db: Db,
  input: { name: string; description?: string },
): Promise<Operation> {
  const name = input.name.trim();
  if (!name) {
    throw new ValidationError("Die Bezeichnung darf nicht leer sein.");
  }
  const description = input.description?.trim() || null;

  return db.transaction(async (tx) => {
    const operation = await insertOperation(tx, { name, description });
    await appendEntry(tx, {
      operationId: operation.id,
      text: OPERATION_OPENED_ENTRY_TEXT,
      type: "einsatz-eröffnet",
      author: null,
      route: NO_ROUTE,
    });
    return operation;
  });
}
