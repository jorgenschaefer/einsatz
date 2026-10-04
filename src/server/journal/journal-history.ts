import { randomUUID } from "node:crypto";
import type { EntryContent } from "@/journal/entry-route";
import {
  canAnnulEntry,
  canCorrectEntry,
  type JournalEntryType,
} from "@/journal/entry-type";
import type { Db, Queryable } from "@/server/db/db";
import { assertUuid, ValidationError } from "@/server/validation";
import { type JournalEntry, loadEntry, requireEntryContent } from "./journal";

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
