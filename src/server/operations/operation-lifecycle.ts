import type { Db, Queryable } from "@/server/db/db";
import { appendEntry } from "@/server/journal/journal";
import { OPERATION_OPENED_ENTRY_TEXT } from "./create-operation";
import { getOperation, lockOperation, setOperationStatus } from "./operations";

/** Automatischer ETB-Eintrag beim Abschließen eines Einsatzes. */
export const OPERATION_CLOSED_ENTRY_TEXT = "Einsatz geschlossen";

export async function closeOperation(db: Db, id: string): Promise<void> {
  await transition(db, id, {
    from: "active",
    to: "closed",
    text: OPERATION_CLOSED_ENTRY_TEXT,
    type: "einsatz-geschlossen",
  });
}

export async function reopenOperation(db: Db, id: string): Promise<void> {
  await transition(db, id, {
    from: "closed",
    to: "active",
    text: OPERATION_OPENED_ENTRY_TEXT,
    type: "einsatz-eröffnet",
  });
}

async function transition(
  db: Db,
  id: string,
  change: {
    from: "active" | "closed";
    to: "active" | "closed";
    text: string;
    type: "einsatz-geschlossen" | "einsatz-eröffnet";
  },
): Promise<void> {
  await db.transaction(async (tx: Queryable) => {
    // Einsatz-Zeile sperren, damit parallele Übergänge nicht denselben
    // Meilenstein doppelt schreiben (Status prüfen erst nach der Sperre).
    await lockOperation(tx, id);
    const operation = await getOperation(tx, id);
    if (!operation || operation.status !== change.from) return; // kein No-op-Meilenstein
    await setOperationStatus(tx, id, change.to);
    await appendEntry(tx, {
      operationId: id,
      text: change.text,
      type: change.type,
      author: null,
    });
  });
}
