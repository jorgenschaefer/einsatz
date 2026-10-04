import { NO_ROUTE } from "@/journal/entry-route";
import type { JournalEntryView } from "./JournalEntry";

export function entry(over: Partial<JournalEntryView> = {}): JournalEntryView {
  return {
    id: "e1",
    number: 1,
    createdAt: "2026-07-03T08:00:00.000Z",
    text: "Deich hält",
    type: "manuell",
    state: "gueltig",
    author: "anna",
    editedAt: null,
    ...NO_ROUTE,
    revisions: [],
    ...over,
  };
}
