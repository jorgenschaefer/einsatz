import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import { render, screen } from "@/test/render";
import {
  type JournalEntryView,
  JournalPanel,
  type JournalPanelProps,
} from "./JournalPanel";

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

export function panelProps(
  over: Partial<JournalPanelProps> = {},
): JournalPanelProps {
  return {
    entries: [entry()],
    correspondents: [],
    onAdd: vi.fn(async () => ({})),
    onCorrect: vi.fn(async () => ({})),
    onAnnul: vi.fn(async () => ({})),
    visible: true,
    ...over,
  };
}

export function setup(over: Partial<JournalPanelProps> = {}) {
  const props = panelProps(over);
  render(<JournalPanel {...props} />);
  return props;
}

export async function chooseAction(number: number, name: string) {
  await userEvent.click(
    screen.getByRole("button", { name: `Aktionen für Eintrag #${number}` }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name }));
}
