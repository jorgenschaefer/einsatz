import type { JournalEntryView } from "@/app/operations/[id]/JournalPanel";

/**
 * Neue ETB-Einträge seit `seenUpTo` (höchste gesehene Eintragsnummer), ohne die
 * eigenen. Automatische Einträge (`author: null`) zählen mit.
 */
export function countUnseenEntries(
  entries: Pick<JournalEntryView, "number" | "author">[],
  seenUpTo: number,
  currentUsername: string,
): number {
  return entries.filter(
    (entry) => entry.number > seenUpTo && entry.author !== currentUsername,
  ).length;
}
