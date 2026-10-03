import userEvent from "@testing-library/user-event";
import { expect, vi } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { JournalEntryView } from "@/journal/JournalPanel";
import { act, render, screen, waitFor, within } from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import type { ImagePlacement } from "./image-overlay";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";
import { aSymbol } from "./symbol.fixtures";

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
    onCreateViewLink: vi.fn(async () => ({})),
    onDeleteViewLink: vi.fn(async () => ({})),
    operationDefaultView: null,
    tileUrl: "t",
    attribution: "© OpenStreetMap",
    symbols: [],
    journalEntries: [],
    correspondents: [],
    onAddJournalEntry: vi.fn(async () => ({})),
    onCorrectJournalEntry: vi.fn(async () => ({})),
    onAnnulJournalEntry: vi.fn(async () => ({})),
    onSetDefault: vi.fn(async () => ({})),
    onPlace: vi.fn(async () => ({})),
    onMove: vi.fn(async () => ({})),
    onUpdate: vi.fn(async () => ({})),
    onDelete: vi.fn(async () => ({})),
    onGenerateDeviceLink: vi.fn(async () => ({})),
    onRemoveDeviceLink: vi.fn(async () => ({})),
    onGeocode: vi.fn(async () => []),
    geocoderAttribution: "© OpenStreetMap",
    areas: [],
    onCreateArea: vi.fn(async () => ({})),
    onUpdateAreaStyle: vi.fn(async () => ({})),
    onUpdateAreaGeometry: vi.fn(async () => ({})),
    onDeleteArea: vi.fn(async () => ({})),
    kmlOverlays: [],
    onAddKmlUrl: vi.fn(async () => ({})),
    onSetKmlVisibility: vi.fn(async () => ({})),
    onReloadKml: vi.fn(async () => ({})),
    onRemoveKml: vi.fn(async () => ({})),
    imageOverlays: [],
    onUpdateImagePlacement: vi.fn(async () => ({})),
    onSetImageVisibility: vi.fn(async () => ({})),
    onDeleteImage: vi.fn(async () => ({})),
    stations: [],
    onCreateStation: vi.fn(async () => ({})),
    onRenameStation: vi.fn(async () => ({})),
    onRecordStrengthReport: vi.fn(async () => ({})),
    onReportTotalStrength: vi.fn(async () => ({})),
    onCorrectStrengthReport: vi.fn(async () => ({})),
    onAnnulStrengthReport: vi.fn(async () => ({})),
    factory: fake.factory,
    ...over,
  };
  return { ...fake, props };
}

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

export const SYMBOL = aSymbol({
  composition: {
    grundzeichen: "taktische-formation",
    organisation: "hilfsorganisation",
    text: "Pumpe 1",
  },
});

export const AREA = {
  id: "a1",
  geometry: {
    shape: "circle" as const,
    center: { lat: 53.5, lng: 9.9 },
    radius: 100,
  },
  color: "#e2001a",
  opacity: 0.4,
  label: "Deich",
};

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

/**
 * Der Knopf mit diesem Text, für Prüfungen am Knopf selbst (Name, disabled,
 * aria-pressed); `getByText` liefert nur das Textelement darin.
 */
export const buttonWithText = (
  text: string | RegExp,
  container = document.body,
) => within(container).getByText(text).closest("button") as HTMLElement;

export const modeBand = (label: string) =>
  screen.getByRole("toolbar", { name: label });

export const startEditingImage = async () => {
  await openPanel("Ebenen");
  await userEvent.click(await screen.findByText("Bearbeiten"));
};

// Am Handy schließt das Blatt, sobald das Bearbeiten beginnt; den Editor
// zeigt das wieder geöffnete Ebenen-Panel.
export const openImageEditor = async () => {
  await startEditingImage();
  await openPanel("Ebenen");
};

/** Ends a gesture on the map that scales the edited Bild-Overlay. */
export const scaleOnMap = async (
  adapter: ReturnType<typeof renderWorkspace>["adapter"],
) => {
  await waitFor(() => expect(adapter.startImageOverlayEdit).toHaveBeenCalled());
  const onChange = adapter.startImageOverlayEdit.mock.calls.at(-1)?.[1] as (
    placement: ImagePlacement,
  ) => void;
  await act(async () => onChange({ ...anImageOverlay.placement, scaleM: 800 }));
};

export const anImageOverlay = {
  id: "i1",
  name: "Lageplan",
  imageUrl: "/img/i1",
  placement: {
    centerLat: 53.5,
    centerLng: 9.9,
    scaleM: 500,
    rotationDeg: 10,
    opacity: 0.8,
  },
  aspect: 1.5,
  visible: true,
};
