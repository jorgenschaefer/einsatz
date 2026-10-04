import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { JournalEntryView } from "@/journal/JournalPanel";
import { render, screen } from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";

export const selectMainView = (name: "Lagekarte" | "ETB" | "Stärke") =>
  userEvent.click(screen.getAllByText(name)[0]);

/**
 * Gibt Mantines AppShell die Höhe der Leiste an die Hauptansicht zurück?
 * jsdom rechnet kein Layout; sichtbar ist das nur an der CSS-Variable, die
 * AppShell in ihr Inline-Stylesheet schreibt.
 */
export const footerOffsetReleased = () =>
  [...document.querySelectorAll("style")].some((style) =>
    style.textContent?.includes("--app-shell-footer-offset:0px !important"),
  );

export function buildProps(over: Partial<SituationWorkspaceProps> = {}) {
  const fake = fakeMapAdapterFactory();
  const props: SituationWorkspaceProps = {
    operationId: "op-x",
    operationName: "Hochwasser",
    status: "active",
    currentUsername: "anna",
    viewLinks: [],
    onCreateViewLink: vi.fn(succeed),
    onDeleteViewLink: vi.fn(succeed),
    operationDefaultView: null,
    tileUrl: "t",
    attribution: "© OpenStreetMap",
    symbols: [],
    journalEntries: [],
    correspondents: [],
    onAddJournalEntry: vi.fn(succeed),
    onCorrectJournalEntry: vi.fn(succeed),
    onAnnulJournalEntry: vi.fn(succeed),
    onSetDefaultView: vi.fn(succeed),
    onPlace: vi.fn(succeed),
    onMove: vi.fn(succeed),
    onUpdate: vi.fn(succeed),
    onDelete: vi.fn(succeed),
    onGenerateDeviceLink: vi.fn(succeed),
    onRemoveDeviceLink: vi.fn(succeed),
    onGeocode: vi.fn(async () => []),
    geocoderAttribution: "© OpenStreetMap",
    areas: [],
    onCreateArea: vi.fn(succeed),
    onUpdateAreaStyle: vi.fn(succeed),
    onUpdateAreaGeometry: vi.fn(succeed),
    onDeleteArea: vi.fn(succeed),
    kmlOverlays: [],
    onAddKmlUrl: vi.fn(succeed),
    onSetKmlVisibility: vi.fn(succeed),
    onReloadKml: vi.fn(succeed),
    onRemoveKml: vi.fn(succeed),
    imageOverlays: [],
    onUpdateImagePlacement: vi.fn(succeed),
    onSetImageVisibility: vi.fn(succeed),
    onDeleteImage: vi.fn(succeed),
    stations: [],
    onCreateStation: vi.fn(succeed),
    onRenameStation: vi.fn(succeed),
    onRecordStrengthReport: vi.fn(succeed),
    onReportTotalStrength: vi.fn(succeed),
    onCorrectStrengthReport: vi.fn(succeed),
    onAnnulStrengthReport: vi.fn(succeed),
    factory: fake.factory,
    ...over,
  };
  return { ...fake, props };
}

/** A server action that succeeds. */
const succeed = async () => ({});

export function renderWorkspace(over: Partial<SituationWorkspaceProps> = {}) {
  const built = buildProps(over);
  render(<SituationWorkspace {...built.props} />);
  return built;
}

export type PanelName = "Kartenzeichen" | "Bereiche" | "Ebenen";

// Die Kartenpanels leben nur in der Lagekarten-Hauptansicht; erst hinschalten,
// dann den Eintrag in der Reihe der Kartenpanels tippen.
export const openPanel = async (name: PanelName) => {
  await selectMainView("Lagekarte");
  await userEvent.click(screen.getByLabelText(name, { selector: "button" }));
};

export const mapPanel = (name: PanelName) =>
  screen.getByRole("region", { name });
export const anyMapPanel = () =>
  screen.queryByRole("region", { name: /^(Kartenzeichen|Bereiche|Ebenen)$/ });

export const journalEntry = (
  number: number,
  author: string | null,
): JournalEntryView => ({
  id: `e${number}`,
  number,
  createdAt: "2026-07-03T08:00:00.000Z",
  text: `Eintrag ${number}`,
  type: "manuell",
  state: "gueltig",
  author,
  editedAt: null,
  ...NO_ROUTE,
  revisions: [],
});

export const modeBand = (label: string) =>
  screen.getByRole("toolbar", { name: label });

const startEditingImage = async () => {
  await openPanel("Ebenen");
  await userEvent.click(await screen.findByText("Bearbeiten"));
};

// Am Handy schließt das Blatt, sobald das Bearbeiten beginnt; den Editor
// zeigt das wieder geöffnete Ebenen-Panel.
export const openImageEditor = async () => {
  await startEditingImage();
  await openPanel("Ebenen");
};
