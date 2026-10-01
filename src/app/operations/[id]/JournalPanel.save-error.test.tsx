import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { screen, within } from "@/test/render";
import type { JournalPanelProps } from "./JournalPanel";
import {
  addButton,
  chooseAction,
  correctionField,
  correctionForm,
  newEntry,
  newEntryField,
  setup,
} from "./JournalPanel.fixtures";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

const saveButton = () =>
  within(correctionForm()).getByRole("button", { name: "Speichern" });
const dismissButton = () =>
  screen.getByRole("button", { name: "Meldung schließen" });

const isBetween = (element: Node, before: Node, after: Node) =>
  Boolean(
    before.compareDocumentPosition(element) &
      Node.DOCUMENT_POSITION_FOLLOWING &&
      element.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

const failing = () =>
  vi.fn(async () => {
    throw new Error("offline");
  });

async function add(text: string) {
  await userEvent.type(newEntryField(), text);
  await userEvent.click(addButton());
}

async function correct(text: string) {
  await chooseAction(1, "Korrigieren");
  await userEvent.clear(correctionField());
  await userEvent.type(correctionField(), text);
  await userEvent.click(saveButton());
}

describe("JournalPanel – Meldung, wenn das Speichern scheitert", () => {
  describe("in Neuer Eintrag", () => {
    it("shows the error between the text field and Eintrag hinzufügen", async () => {
      setup({ onAdd: failing() });

      await add("Neue Lage");

      const alert = await screen.findByRole("alert");
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(alert).toHaveTextContent(SAVE_ERROR);
      expect(newEntry()).toContainElement(alert);
      expect(isBetween(alert, newEntryField(), addButton())).toBe(true);
      expect(newEntryField()).toHaveValue("Neue Lage");
    });

    it("shows a returned error word for word", async () => {
      setup({
        onAdd: vi.fn<JournalPanelProps["onAdd"]>(async () => ({
          error: "Der Einsatz ist geschlossen.",
        })),
      });

      await add("Neue Lage");

      expect(within(newEntry()).getByRole("alert")).toHaveTextContent(
        "Der Einsatz ist geschlossen.",
      );
    });

    it("drops the error after the next successful save", async () => {
      const onAdd = vi
        .fn<JournalPanelProps["onAdd"]>()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({});
      setup({ onAdd });

      await add("Neue Lage");
      await screen.findByRole("alert");
      await userEvent.click(addButton());

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("drops the error on its ×", async () => {
      setup({ onAdd: failing() });

      await add("Neue Lage");
      await screen.findByRole("alert");
      await userEvent.click(dismissButton());

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("leaves an open correction without the error", async () => {
      setup({ onAdd: failing() });

      await chooseAction(1, "Korrigieren");
      await add("Neue Lage");
      await screen.findByRole("alert");

      expect(within(correctionForm()).queryByRole("alert")).toBeNull();
    });

    describe("scrolling", () => {
      let scrollIntoView: MockInstance<Element["scrollIntoView"]>;

      beforeEach(() => {
        scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
      });

      afterEach(() => scrollIntoView.mockRestore());

      it("brings the error and Eintrag hinzufügen into view", async () => {
        setup({ onAdd: failing() });
        await userEvent.type(newEntryField(), "Neue Lage");
        scrollIntoView.mockClear();

        await userEvent.click(addButton());
        await screen.findByRole("alert");

        expect(scrollIntoView.mock.contexts.at(-1)).toBe(newEntry());
        expect(scrollIntoView.mock.calls.at(-1)).toEqual([{ block: "end" }]);
      });
    });
  });

  describe("in a correction", () => {
    it("shows the error inside the corrected entry, between its text field and Speichern", async () => {
      setup({ onCorrect: failing() });

      await correct("Neuer Text");

      const alert = await screen.findByRole("alert");
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(alert).toHaveTextContent(SAVE_ERROR);
      expect(correctionForm()).toContainElement(alert);
      expect(isBetween(alert, correctionField(), saveButton())).toBe(true);
      expect(within(newEntry()).queryByRole("alert")).toBeNull();
    });

    it("shows a returned error word for word", async () => {
      setup({
        onCorrect: vi.fn<JournalPanelProps["onCorrect"]>(async () => ({
          error: "Annullierte Einträge können nicht geändert werden.",
        })),
      });

      await correct("Neuer Text");

      expect(within(correctionForm()).getByRole("alert")).toHaveTextContent(
        "Annullierte Einträge können nicht geändert werden.",
      );
    });

    it("keeps Text, Von, An and Weg of the correction", async () => {
      setup({ correspondents: ["EAL", "UHSt 2"], onCorrect: failing() });

      await chooseAction(1, "Korrigieren");
      const form = within(correctionForm());
      await userEvent.click(
        within(form.getByRole("group", { name: "Von" })).getByRole("checkbox", {
          name: "UHSt 2",
        }),
      );
      await userEvent.click(
        within(form.getByRole("group", { name: "An" })).getByRole("checkbox", {
          name: "EAL",
        }),
      );
      await userEvent.selectOptions(
        form.getByRole("combobox", { name: "Weg" }),
        "Telefon",
      );
      await userEvent.clear(correctionField());
      await userEvent.type(correctionField(), "Neuer Text");
      await userEvent.click(saveButton());
      await screen.findByRole("alert");

      expect(correctionField()).toHaveValue("Neuer Text");
      expect(
        within(form.getByRole("group", { name: "Von" })).getByRole("checkbox", {
          name: "UHSt 2",
        }),
      ).toBeChecked();
      expect(
        within(form.getByRole("group", { name: "An" })).getByRole("checkbox", {
          name: "EAL",
        }),
      ).toBeChecked();
      expect(form.getByRole("combobox", { name: "Weg" })).toHaveDisplayValue(
        "Telefon",
      );
    });

    it("drops the error on Abbrechen", async () => {
      setup({ onCorrect: failing() });

      await correct("Neuer Text");
      await screen.findByRole("alert");
      await userEvent.click(
        within(correctionForm()).getByRole("button", { name: "Abbrechen" }),
      );
      await chooseAction(1, "Korrigieren");

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("drops the error on its ×", async () => {
      setup({ onCorrect: failing() });

      await correct("Neuer Text");
      await screen.findByRole("alert");
      await userEvent.click(dismissButton());

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("drops the error once the correction is saved", async () => {
      const onCorrect = vi
        .fn<JournalPanelProps["onCorrect"]>()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({});
      setup({ onCorrect });

      await correct("Neuer Text");
      await screen.findByRole("alert");
      await userEvent.click(saveButton());
      await chooseAction(1, "Korrigieren");

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("leaves Neuer Eintrag without the error", async () => {
      setup({ onCorrect: failing() });

      await userEvent.type(newEntryField(), "Entwurf");
      await correct("Neuer Text");
      await screen.findByRole("alert");

      expect(within(newEntry()).queryByRole("alert")).toBeNull();
      expect(newEntryField()).toHaveValue("Entwurf");
    });
  });
});
