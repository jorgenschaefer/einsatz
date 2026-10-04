import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { entry } from "@/journal/JournalPanel.fixtures";
import { report } from "@/strength/StrengthPanel.fixtures";
import { render, screen, within } from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import { succeed } from "./SituationMapView.fixtures";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";

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

export function renderWorkspace(over: Partial<SituationWorkspaceProps> = {}) {
  const built = buildProps(over);
  render(<SituationWorkspace {...built.props} />);
  return built;
}

/** Was die Abläufe unten in den Panels vorfinden. */
export const PANEL_CONTENT = {
  journalEntries: [entry({ author: null })],
  correspondents: ["EAL"],
  stations: [{ id: "st1", name: "UHSt 3", reports: [report({ number: 3 })] }],
  viewLinks: [{ id: "1", label: "Leitstelle", token: "tok-a" }],
} satisfies Partial<SituationWorkspaceProps>;

export const selectMainView = (name: "Lagekarte" | "ETB" | "Stärke") =>
  userEvent.click(screen.getAllByText(name)[0]);

export const pane = (view: "etb" | "map" | "strength") =>
  document.querySelector(`[data-view="${view}"]`) as HTMLElement;

export const returnButton = () =>
  screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
    selector: "button",
  });

export const headerMenu = (header: "desktop-header" | "mobile-header") =>
  userEvent.click(
    within(screen.getByTestId(header)).getByRole("button", { name: "Menü" }),
  );

export const chooseMenuItem = async (name: string) =>
  userEvent.click(await screen.findByRole("menuitem", { name }));

/** Öffnet das ⋮ Menü der Handy-Kopfzeile und gibt „Standard-Ausschnitt festlegen". */
export async function defaultViewMenuItem() {
  await headerMenu("mobile-header");
  return screen.findByRole("menuitem", {
    name: "Standard-Ausschnitt festlegen",
  });
}

/** Legt über das ⋮ Menü den Standard-Ausschnitt fest; gibt den Dialog. */
export async function setDefaultView() {
  await userEvent.click(await defaultViewMenuItem());
  const dialog = await screen.findByRole("dialog", {
    name: "Standard-Ausschnitt festlegen",
  });
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Festlegen" }),
  );
  return dialog;
}

type PanelName = "Kartenzeichen" | "Bereiche" | "Ebenen";

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

const ENTRY_MENU = "Aktionen für Eintrag #1";
const REPORT_MENU = "Aktionen für Meldung 11:01 (#3)";

export async function addJournalEntry() {
  // Die Chips „EAL" stehen unter Von, dann unter An.
  await userEvent.click(screen.getAllByRole("checkbox", { name: "EAL" })[0]);
  await typeInto("Neuer Eintrag", "Deich");
  await click("Eintrag hinzufügen");
}

export async function correctJournalEntry() {
  await choose(ENTRY_MENU, "Korrigieren");
  await click("Speichern");
}

export async function annulJournalEntry() {
  await choose(ENTRY_MENU, "Annullieren …");
  await confirm("Annullieren");
}

export async function createStation() {
  await selectMainView("Stärke");
  await click("+ Stelle");
  await typeInto("Name der Stelle", "Ziel{Enter}");
}

export async function renameStation() {
  await selectMainView("Stärke");
  await click("UHSt 3 umbenennen");
  await typeInto("Neuer Name", " Nord{Enter}");
}

export async function recordStrengthReport() {
  await selectMainView("Stärke");
  await click("UHSt 3");
  await click("Melden");
}

export async function reportTotalStrength() {
  await selectMainView("Stärke");
  await click("Gesamtstärke melden");
  await confirm("Melden");
}

export async function correctStrengthReport() {
  await selectMainView("Stärke");
  await click("UHSt 3");
  await choose(REPORT_MENU, "Korrigieren");
  await click("Speichern");
}

export async function annulStrengthReport() {
  await selectMainView("Stärke");
  await click("UHSt 3");
  await choose(REPORT_MENU, "Annullieren …");
  await confirm("Annullieren");
}

export async function createViewLink() {
  await headerMenu("desktop-header");
  await chooseMenuItem("Teilen");
  await typeInto("Bezeichnung", "Lagezentrum");
  await click("Ansichtslink erzeugen");
}

export async function deleteViewLink() {
  await headerMenu("desktop-header");
  await chooseMenuItem("Teilen");
  await click("Leitstelle löschen");
  await confirm("Endgültig löschen", "Ansichtslink „Leitstelle“ löschen");
}

const click = async (name: string) =>
  userEvent.click(await screen.findByRole("button", { name }));

const typeInto = (name: string, text: string) =>
  userEvent.type(screen.getByRole("textbox", { name }), text);

/** Wählt im Menü `menu` (einem Knopf) den Eintrag `action`. */
const choose = async (menu: string, action: string) => {
  await click(menu);
  await chooseMenuItem(action);
};

/** Klickt `button` im Dialog, bei mehreren in dem namens `dialog`. */
const confirm = async (button: string, dialog?: string) =>
  userEvent.click(
    within(await screen.findByRole("dialog", { name: dialog })).getByRole(
      "button",
      { name: button },
    ),
  );
