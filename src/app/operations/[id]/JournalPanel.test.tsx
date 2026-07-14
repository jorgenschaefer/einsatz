import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import {
  type JournalEntryView,
  JournalPanel,
  type JournalPanelProps,
} from "./JournalPanel";

function entry(over: Partial<JournalEntryView> = {}): JournalEntryView {
  return {
    id: "e1",
    number: 1,
    createdAt: "2026-07-03T08:00:00.000Z",
    text: "Deich hält",
    type: "manuell",
    state: "gueltig",
    author: "anna",
    editedAt: null,
    revisions: [],
    ...over,
  };
}

function setup(over: Partial<JournalPanelProps> = {}) {
  const props: JournalPanelProps = {
    entries: [entry()],
    onAdd: vi.fn(async () => ({})),
    onCorrect: vi.fn(async () => ({})),
    onAnnul: vi.fn(async () => ({})),
    ...over,
  };
  render(<JournalPanel {...props} />);
  return props;
}

describe("JournalPanel", () => {
  it("shows each entry with its number, text and author", () => {
    setup();
    expect(screen.getByText("Deich hält")).toBeInTheDocument();
    expect(screen.getByText(/anna/)).toBeInTheDocument();
    expect(screen.getByText(/^#?\s*1\b/)).toBeInTheDocument();
  });

  it("marks automatic entries and offers no correct/annul actions for them", () => {
    setup({
      entries: [
        entry({
          id: "a",
          number: 1,
          type: "einsatz-eröffnet",
          text: "Einsatz eröffnet",
          author: null,
        }),
      ],
    });
    const item = screen
      .getByText("Einsatz eröffnet")
      .closest("[data-entry]") as HTMLElement;
    expect(within(item).getByText(/automatisch/i)).toBeInTheDocument();
    expect(
      within(item).queryByRole("button", { name: /Korrigieren/ }),
    ).toBeNull();
    expect(
      within(item).queryByRole("button", { name: /Annullieren/ }),
    ).toBeNull();
  });

  it("adds a new manual entry from the input row", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText(/Neuer Eintrag/), "Neue Lage");
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(props.onAdd).toHaveBeenCalledWith("Neue Lage");
  });

  it("adds a new manual entry with Strg+Enter in the input field", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText(/Neuer Eintrag/), "Neue Lage");
    await userEvent.type(
      screen.getByLabelText(/Neuer Eintrag/),
      "{Control>}{Enter}{/Control}",
    );
    expect(props.onAdd).toHaveBeenCalledWith("Neue Lage");
  });

  it("does not add an empty entry", async () => {
    const props = setup();
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("annuls a manual entry", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Annullieren/ }));
    expect(props.onAnnul).toHaveBeenCalledWith("e1");
  });

  it("corrects a manual entry through an inline edit prefilled with the current text", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Korrigieren/ }));
    const field = screen.getByLabelText(/Korrektur/);
    await userEvent.clear(field);
    await userEvent.type(field, "Deich hält nicht");
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(props.onCorrect).toHaveBeenCalledWith("e1", "Deich hält nicht");
  });

  it("renders prior fassungen struck through with their author", () => {
    setup({
      entries: [
        entry({
          text: "Deich hält nicht",
          author: "bernd",
          editedAt: "2026-07-03T09:00:00.000Z",
          revisions: [
            {
              text: "Deich hält",
              author: "anna",
              createdAt: "2026-07-03T08:00:00.000Z",
            },
          ],
        }),
      ],
    });
    const prior = screen.getByText("Deich hält");
    expect(prior.closest("del")).toBeInTheDocument();
    // The prior fassung stays visible with its original author.
    expect(screen.getByText(/–\s*anna/)).toBeInTheDocument();
  });

  it("renders an annulled entry struck through while keeping its number", () => {
    setup({
      entries: [entry({ number: 4, state: "annulliert", text: "Fehleintrag" })],
    });
    expect(screen.getByText("Fehleintrag").closest("del")).toBeInTheDocument();
    expect(screen.getByText(/^#?\s*4\b/)).toBeInTheDocument();
  });

  it("offers no correct/annul actions on an annulled entry", () => {
    setup({ entries: [entry({ state: "annulliert", text: "Fehleintrag" })] });
    expect(screen.queryByRole("button", { name: /Korrigieren/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Annullieren/ })).toBeNull();
  });

  it("surfaces a save error and keeps the draft when adding fails", async () => {
    const onAdd = vi
      .fn<JournalPanelProps["onAdd"]>()
      .mockRejectedValue(new Error("boom"));
    setup({ onAdd });
    await userEvent.type(screen.getByLabelText(/Neuer Eintrag/), "Neue Lage");
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/Neuer Eintrag/)).toHaveValue("Neue Lage");
  });

  it("saves a correction with Strg+Enter in the edit field", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Korrigieren/ }));
    const field = screen.getByLabelText(/Korrektur/);
    await userEvent.clear(field);
    await userEvent.type(field, "Deich hält nicht{Control>}{Enter}{/Control}");
    expect(props.onCorrect).toHaveBeenCalledWith("e1", "Deich hält nicht");
  });

  it("surfaces a save error when a correction fails", async () => {
    const onCorrect = vi
      .fn<JournalPanelProps["onCorrect"]>()
      .mockRejectedValue(new Error("boom"));
    setup({ onCorrect });
    await userEvent.click(screen.getByRole("button", { name: /Korrigieren/ }));
    const field = screen.getByLabelText(/Korrektur/);
    await userEvent.clear(field);
    await userEvent.type(field, "Neuer Text");
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("surfaces a returned {error} from a correction (business ValidationError)", async () => {
    const onCorrect = vi
      .fn<JournalPanelProps["onCorrect"]>()
      .mockResolvedValue({
        error: "Annullierte Einträge können nicht geändert werden.",
      });
    setup({ onCorrect });
    await userEvent.click(screen.getByRole("button", { name: /Korrigieren/ }));
    const field = screen.getByLabelText(/Korrektur/);
    await userEvent.clear(field);
    await userEvent.type(field, "Neuer Text");
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(
      await screen.findByText(
        "Annullierte Einträge können nicht geändert werden.",
      ),
    ).toBeInTheDocument();
  });

  it("surfaces a save error when annulling fails", async () => {
    const onAnnul = vi
      .fn<JournalPanelProps["onAnnul"]>()
      .mockRejectedValue(new Error("boom"));
    setup({ onAnnul });
    await userEvent.click(screen.getByRole("button", { name: /Annullieren/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows a correction timestamp on a corrected entry", () => {
    setup({ entries: [entry({ editedAt: "2026-07-03T09:30:00.000Z" })] });
    expect(screen.getByText(/korrigiert/i)).toBeInTheDocument();
  });

  it("hides automatic entries when the filter is enabled, keeping manual ones", async () => {
    setup({
      entries: [
        entry({
          id: "a",
          number: 1,
          type: "einsatz-eröffnet",
          text: "Einsatz eröffnet",
          author: null,
        }),
        entry({
          id: "m",
          number: 2,
          type: "manuell",
          text: "Deich hält",
          author: "anna",
        }),
      ],
    });
    await userEvent.click(screen.getByLabelText(/automatische ausblenden/i));
    expect(screen.queryByText("Einsatz eröffnet")).toBeNull();
    expect(screen.getByText("Deich hält")).toBeInTheDocument();
  });
});
