import { randomUUID } from "node:crypto";
import type { Db, Queryable } from "@/server/db/db";
import { lockOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";

export type JournalEntryType =
  | "manuell"
  | "einsatz-eröffnet"
  | "einsatz-geschlossen"
  | "stelle-angelegt"
  | "stelle-umbenannt";
export type JournalEntryState = "gueltig" | "annulliert";

/** Eine frühere Fassung eines Eintrags mit eigenem Urheber und Zeitstempel. */
export interface JournalRevision {
  text: string;
  author: string | null;
  createdAt: Date;
}

export interface JournalEntry {
  id: string;
  operationId: string;
  number: number;
  createdAt: Date;
  text: string;
  type: JournalEntryType;
  state: JournalEntryState;
  author: string | null;
  /** Schreibzeitpunkt der aktuellen Fassung; null, wenn nie korrigiert. */
  editedAt: Date | null;
  /** Frühere Fassungen, älteste zuerst. */
  revisions: JournalRevision[];
}

interface JournalRow {
  id: string;
  operation_id: string;
  number: number;
  created_at: string | Date;
  text: string;
  type: JournalEntryType;
  state: JournalEntryState;
  author: string | null;
  edited_at: string | Date | null;
}

const toEntry = (
  row: JournalRow,
  revisions: JournalRevision[] = [],
): JournalEntry => ({
  id: row.id,
  operationId: row.operation_id,
  number: row.number,
  createdAt: new Date(row.created_at),
  text: row.text,
  type: row.type,
  state: row.state,
  author: row.author,
  editedAt: row.edited_at ? new Date(row.edited_at) : null,
  revisions,
});

const COLUMNS =
  "id, operation_id, number, created_at, text, type, state, author, edited_at";

/** Die eine Stelle für „ETB-Text darf nicht leer sein": trimmt und erzwingt. */
function requireEntryText(raw: string): string {
  const text = raw.trim();
  if (!text) throw new ValidationError("Der Text darf nicht leer sein.");
  return text;
}

/**
 * Hängt einen Eintrag mit der nächsten lückenlosen Nummer an das ETB des
 * Einsatzes an. Muss innerhalb einer Transaktion laufen; sperrt die
 * Einsatz-Zeile, damit parallele Anhänge nicht dieselbe Nummer vergeben.
 *
 * Die Serialisierung leistet der `FOR UPDATE`-Lock ({@link lockOperation});
 * der `UNIQUE (operation_id, number)`-Constraint ist der Backstop der DB. Beides
 * ist in `journal.test.ts` gepinnt.
 */
export async function appendEntry(
  tx: Queryable,
  input: {
    operationId: string;
    text: string;
    type: JournalEntryType;
    author: string | null;
  },
): Promise<JournalEntry> {
  const text = requireEntryText(input.text);
  await lockOperation(tx, input.operationId);
  const { rows: numberRows } = await tx.query<{ next: number }>(
    "SELECT COALESCE(MAX(number), 0) + 1 AS next FROM journal_entries WHERE operation_id = $1",
    [input.operationId],
  );
  const number = numberRows[0].next;

  const { rows } = await tx.query<JournalRow>(
    `INSERT INTO journal_entries (id, operation_id, number, text, type, author)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [randomUUID(), input.operationId, number, text, input.type, input.author],
  );
  return toEntry(rows[0]);
}

export async function listEntries(
  db: Queryable,
  operationId: string,
): Promise<JournalEntry[]> {
  const { rows } = await db.query<JournalRow>(
    `SELECT ${COLUMNS} FROM journal_entries WHERE operation_id = $1 ORDER BY number ASC`,
    [operationId],
  );

  const { rows: revisionRows } = await db.query<{
    entry_id: string;
    text: string;
    author: string | null;
    created_at: string | Date;
  }>(
    `SELECT r.entry_id, r.text, r.author, r.created_at
       FROM journal_entry_revisions r
       JOIN journal_entries e ON e.id = r.entry_id
      WHERE e.operation_id = $1
      ORDER BY r.seq ASC`,
    [operationId],
  );

  const revisionsByEntry = new Map<string, JournalRevision[]>();
  for (const r of revisionRows) {
    const list = revisionsByEntry.get(r.entry_id) ?? [];
    list.push({
      text: r.text,
      author: r.author,
      createdAt: new Date(r.created_at),
    });
    revisionsByEntry.set(r.entry_id, list);
  }

  return rows.map((row) => toEntry(row, revisionsByEntry.get(row.id) ?? []));
}

async function loadEntry(
  tx: Queryable,
  entryId: string,
  forUpdate = false,
): Promise<JournalEntry | null> {
  const { rows } = await tx.query<JournalRow>(
    `SELECT ${COLUMNS} FROM journal_entries WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [entryId],
  );
  if (!rows[0]) return null;

  const { rows: revisionRows } = await tx.query<{
    text: string;
    author: string | null;
    created_at: string | Date;
  }>(
    "SELECT text, author, created_at FROM journal_entry_revisions WHERE entry_id = $1 ORDER BY seq ASC",
    [entryId],
  );
  const revisions = revisionRows.map((r) => ({
    text: r.text,
    author: r.author,
    createdAt: new Date(r.created_at),
  }));
  return toEntry(rows[0], revisions);
}

/** Wirft, wenn der Eintrag nicht manuell oder bereits annulliert ist. */
function assertManualAndValid(
  entry: JournalEntry | null,
): asserts entry is JournalEntry {
  if (!entry) throw new ValidationError("Eintrag nicht gefunden.");
  if (entry.type !== "manuell") {
    throw new ValidationError("Nur manuelle Einträge können geändert werden.");
  }
  if (entry.state !== "gueltig") {
    throw new ValidationError(
      "Annullierte Einträge können nicht geändert werden.",
    );
  }
}

/**
 * Korrigiert einen manuellen Eintrag: die bisherige Fassung wird als frühere
 * Fassung (mit ihrem Urheber und Zeitstempel) erhalten, die neue Fassung wird
 * zur aktuellen. Nicht-manuelle oder annullierte Einträge sind unantastbar.
 */
export async function correctEntry(
  db: Db,
  entryId: string,
  newText: string,
  author: string,
): Promise<JournalEntry> {
  const text = requireEntryText(newText);

  return db.transaction(async (tx) => {
    const entry = await loadEntry(tx, entryId, true);
    assertManualAndValid(entry);

    await tx.query(
      `INSERT INTO journal_entry_revisions (id, entry_id, text, author, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        randomUUID(),
        entryId,
        entry.text,
        entry.author,
        (entry.editedAt ?? entry.createdAt).toISOString(),
      ],
    );
    await tx.query(
      "UPDATE journal_entries SET text = $2, author = $3, edited_at = now() WHERE id = $1",
      [entryId, text, author],
    );
    const updated = await loadEntry(tx, entryId);
    if (!updated)
      throw new Error("Eintrag nach Aktualisierung nicht gefunden.");
    return updated;
  });
}

/**
 * Annulliert einen manuellen Eintrag: er bleibt mit seiner Nummer und seinem
 * Text erhalten (durchgestrichen), wird aber als `annulliert` markiert.
 * Alle anderen Einträge sind unantastbar.
 */
export async function annulEntry(
  db: Db,
  entryId: string,
): Promise<JournalEntry> {
  return db.transaction(async (tx) => {
    const entry = await loadEntry(tx, entryId, true);
    assertManualAndValid(entry);

    await tx.query(
      "UPDATE journal_entries SET state = 'annulliert' WHERE id = $1",
      [entryId],
    );
    const updated = await loadEntry(tx, entryId);
    if (!updated)
      throw new Error("Eintrag nach Aktualisierung nicht gefunden.");
    return updated;
  });
}
