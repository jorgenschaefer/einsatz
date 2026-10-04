import { randomUUID } from "node:crypto";
import type { EntryContent, EntryRoute } from "@/journal/entry-route";
import type { JournalEntryType } from "@/journal/entry-type";
import type { Queryable } from "@/server/db/db";
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

/** Lädt einen Eintrag samt früherer Fassungen; `forUpdate` sperrt seine Zeile. */
export async function loadEntry(
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
