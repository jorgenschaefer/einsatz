import { randomUUID } from "node:crypto";
import type { EntryContent, EntryRoute } from "@/journal/entry-route";
import {
  canAnnulEntry,
  canCorrectEntry,
  type JournalEntryType,
} from "@/journal/entry-type";
import type { Db, Queryable } from "@/server/db/db";
import { lockOperation } from "@/server/operations/operations";
import {
  assertObject,
  assertUuid,
  trimmedText,
  ValidationError,
} from "@/server/validation";

export type JournalEntryState = "gueltig" | "annulliert";

/** Eine frühere Fassung eines Eintrags mit eigenem Urheber und Zeitstempel. */
export interface JournalRevision extends EntryRoute {
  text: string;
  author: string | null;
  createdAt: Date;
}

export interface JournalEntry extends EntryRoute {
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
  sender: string | null;
  recipient: string | null;
  channel: string | null;
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
  sender: row.sender,
  recipient: row.recipient,
  channel: row.channel,
  revisions,
});

interface RevisionRow {
  text: string;
  author: string | null;
  created_at: string | Date;
  sender: string | null;
  recipient: string | null;
  channel: string | null;
}

const toRevision = (row: RevisionRow): JournalRevision => ({
  text: row.text,
  author: row.author,
  createdAt: new Date(row.created_at),
  sender: row.sender,
  recipient: row.recipient,
  channel: row.channel,
});

const REVISION_COLUMNS = "text, author, created_at, sender, recipient, channel";

const COLUMNS =
  "id, operation_id, number, created_at, text, type, state, author, edited_at, sender, recipient, channel";

const MAX_TEXT_LENGTH = 10_000;
const MAX_ROUTE_LENGTH = 200;

/**
 * Prüft, was eine Fassung eines Eintrags sagt, und liefert es getrimmt, wie
 * es gespeichert wird: der Text nicht leer, Von, An und Weg ohne Angabe
 * `null`. Die Längen gelten nach dem Trimmen.
 */
export function requireEntryContent(content: unknown): EntryContent {
  assertObject(content, "Ungültiger ETB-Eintrag.");
  const text = trimmedText(content.text, "Der Text", MAX_TEXT_LENGTH);
  if (!text) throw new ValidationError("Der Text darf nicht leer sein.");
  return {
    text,
    sender: trimmedRouteValue(content.sender, "Von"),
    recipient: trimmedRouteValue(content.recipient, "An"),
    channel: trimmedRouteValue(content.channel, "Der Weg"),
  };
}

function trimmedRouteValue(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return trimmedText(value, field, MAX_ROUTE_LENGTH) || null;
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
    route: EntryRoute;
  },
): Promise<JournalEntry> {
  assertUuid(input.operationId);
  const { text, sender, recipient, channel } = requireEntryContent({
    text: input.text,
    ...input.route,
  });
  await lockOperation(tx, input.operationId);
  const { rows: numberRows } = await tx.query<{ next: number }>(
    "SELECT COALESCE(MAX(number), 0) + 1 AS next FROM journal_entries WHERE operation_id = $1",
    [input.operationId],
  );
  const number = numberRows[0].next;

  const { rows } = await tx.query<JournalRow>(
    `INSERT INTO journal_entries
       (id, operation_id, number, text, type, author, sender, recipient, channel)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLUMNS}`,
    [
      randomUUID(),
      input.operationId,
      number,
      text,
      input.type,
      input.author,
      sender,
      recipient,
      channel,
    ],
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

  const { rows: revisionRows } = await db.query<
    RevisionRow & { entry_id: string }
  >(
    `SELECT entry_id, ${REVISION_COLUMNS}
       FROM journal_entry_revisions
      WHERE entry_id IN (SELECT id FROM journal_entries WHERE operation_id = $1)
      ORDER BY seq ASC`,
    [operationId],
  );

  const revisionsByEntry = new Map<string, JournalRevision[]>();
  for (const r of revisionRows) {
    const list = revisionsByEntry.get(r.entry_id) ?? [];
    list.push(toRevision(r));
    revisionsByEntry.set(r.entry_id, list);
  }

  return rows.map((row) => toEntry(row, revisionsByEntry.get(row.id) ?? []));
}

/**
 * Die Gesprächspartner des Gesamteinsatzes: seine Stellen und Von/An der
 * aktuellen Fassung aller gültigen Einträge. Werte, die sich nur in Groß- und
 * Kleinschreibung unterscheiden, sind einer, in der Schreibweise der jüngsten
 * Verwendung. Die Reihenfolge ist nicht festgelegt.
 */
export async function listCorrespondents(
  db: Queryable,
  operationId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ correspondent: string }>(
    `SELECT DISTINCT ON (lower(correspondent)) correspondent
       FROM (
         SELECT name AS correspondent, named_at AS used_at
           FROM stations WHERE operation_id = $1
         UNION ALL
         SELECT party, COALESCE(edited_at, created_at)
           FROM journal_entries, unnest(ARRAY[sender, recipient]) AS party
          WHERE operation_id = $1 AND state = 'gueltig' AND party IS NOT NULL
       ) AS uses
      ORDER BY lower(correspondent), used_at DESC`,
    [operationId],
  );
  return rows.map((row) => row.correspondent);
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

  const { rows: revisionRows } = await tx.query<RevisionRow>(
    `SELECT ${REVISION_COLUMNS} FROM journal_entry_revisions WHERE entry_id = $1 ORDER BY seq ASC`,
    [entryId],
  );
  return toEntry(rows[0], revisionRows.map(toRevision));
}

/** Wirft, wenn der Eintrag fehlt oder bereits annulliert ist. */
function assertValid(
  entry: JournalEntry | null,
): asserts entry is JournalEntry {
  if (!entry) throw new ValidationError("Eintrag nicht gefunden.");
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
  content: EntryContent,
  author: string,
): Promise<JournalEntry> {
  assertUuid(entryId);
  return db.transaction(async (tx) => {
    const {
      rows: [entry],
    } = await tx.query<{ type: JournalEntryType }>(
      "SELECT type FROM journal_entries WHERE id = $1",
      [entryId],
    );
    if (!entry) throw new ValidationError("Eintrag nicht gefunden.");
    if (!canCorrectEntry(entry.type)) {
      throw new ValidationError(
        "Nur manuelle Einträge können geändert werden.",
      );
    }
    return reviseEntry(tx, entryId, content, author);
  });
}

/**
 * Macht `content` zur aktuellen Fassung des Eintrags und erhält die bisherige
 * samt Route als frühere Fassung mit ihrem Urheber und Zeitstempel. Muss
 * innerhalb einer Transaktion laufen; sperrt die Eintrags-Zeile, damit
 * parallele Korrekturen nacheinander laufen. Annullierte Einträge sind
 * unantastbar.
 */
export async function reviseEntry(
  tx: Queryable,
  entryId: string,
  content: EntryContent,
  author: string,
): Promise<JournalEntry> {
  const { text, sender, recipient, channel } = requireEntryContent(content);
  const entry = await loadEntry(tx, entryId, true);
  assertValid(entry);

  await tx.query(
    `INSERT INTO journal_entry_revisions
       (id, entry_id, text, author, created_at, sender, recipient, channel)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      entryId,
      entry.text,
      entry.author,
      (entry.editedAt ?? entry.createdAt).toISOString(),
      entry.sender,
      entry.recipient,
      entry.channel,
    ],
  );
  await tx.query(
    `UPDATE journal_entries
        SET text = $2, author = $3, edited_at = now(),
            sender = $4, recipient = $5, channel = $6
      WHERE id = $1`,
    [entryId, text, author, sender, recipient, channel],
  );
  const updated = await loadEntry(tx, entryId);
  if (!updated) throw new Error("Eintrag nach Aktualisierung nicht gefunden.");
  return updated;
}

/**
 * Annulliert einen manuellen Eintrag oder eine gemeldete Gesamtstärke: er bleibt
 * mit seiner Nummer und seinem Text erhalten (durchgestrichen), wird aber als
 * `annulliert` markiert. Alle anderen Einträge sind unantastbar.
 */
export async function annulEntry(
  db: Db,
  entryId: string,
): Promise<JournalEntry> {
  assertUuid(entryId);
  return db.transaction(async (tx) => {
    const {
      rows: [entry],
    } = await tx.query<{ type: JournalEntryType }>(
      "SELECT type FROM journal_entries WHERE id = $1",
      [entryId],
    );
    if (!entry) throw new ValidationError("Eintrag nicht gefunden.");
    if (!canAnnulEntry(entry.type)) {
      throw new ValidationError("Dieser Eintrag kann nicht annulliert werden.");
    }
    return markEntryAnnulled(tx, entryId);
  });
}

/**
 * Markiert den Eintrag als `annulliert`; Nummer und Text bleiben. Muss
 * innerhalb einer Transaktion laufen; sperrt die Eintrags-Zeile. Bereits
 * annullierte Einträge sind unantastbar.
 */
export async function markEntryAnnulled(
  tx: Queryable,
  entryId: string,
): Promise<JournalEntry> {
  const entry = await loadEntry(tx, entryId, true);
  assertValid(entry);
  await tx.query(
    "UPDATE journal_entries SET state = 'annulliert' WHERE id = $1",
    [entryId],
  );
  const updated = await loadEntry(tx, entryId);
  if (!updated) throw new Error("Eintrag nach Aktualisierung nicht gefunden.");
  return updated;
}
