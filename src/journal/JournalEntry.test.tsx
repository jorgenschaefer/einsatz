import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { JournalEntryType } from "@/journal/entry-type";
import { render, screen } from "@/test/render";
import { JournalEntry, type JournalEntryView } from "./JournalEntry";
import { entry } from "./JournalEntry.fixtures";

function setup(
  over: Partial<JournalEntryView> = {},
  correction: ReactNode = null,
) {
  const props = {
    entry: entry(over),
    onOpenCorrection: vi.fn(),
    onOpenAnnulConfirmation: vi.fn(),
    correction,
  };
  render(<JournalEntry {...props} />);
  return props;
}

const menuButton = () =>
  screen.queryByRole("button", { name: /Aktionen für Eintrag/ });

async function menuItems() {
  await userEvent.click(
    screen.getByRole("button", { name: "Aktionen für Eintrag #1" }),
  );
  return (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
}

const ROUTED = { sender: "UHSt 2", recipient: "EAL", channel: "Funk" };

/** Die Zeile im Eintrag direkt über seinem Text. */
const lineAbove = (text: string) =>
  screen.getByText(text).previousElementSibling?.textContent;

const struck = (text: string) =>
  screen.getByText(
    (_, element) => element?.tagName === "DEL" && element.textContent === text,
  );

describe("JournalEntry", () => {
  it("shows its number, time, text and author", () => {
    setup();

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("03.07.26, 10:00")).toBeInTheDocument();
    expect(screen.getByText("Deich hält")).toBeInTheDocument();
    expect(screen.getByText("anna")).toBeInTheDocument();
  });

  it("shows its Von, An and Weg above the text", () => {
    setup(ROUTED);

    expect(lineAbove("Deich hält")).toBe("Von UHSt 2 an EAL · Funk");
  });

  it.each<[JournalEntryType, boolean, string[]]>([
    ["manuell", false, ["Korrigieren", "Annullieren …"]],
    ["einsatz-eröffnet", true, []],
    ["einsatz-geschlossen", true, []],
    ["stelle-angelegt", true, []],
    ["stelle-umbenannt", false, []],
    ["stärkemeldung", false, []],
    ["gesamtstärke-gemeldet", false, ["Annullieren …"]],
  ])(
    "marks a %s entry as automatic: %s, and offers %j",
    async (type, automatic, actions) => {
      setup({ type });

      expect(screen.queryByText("automatisch") !== null).toBe(automatic);
      if (actions.length === 0) {
        expect(menuButton()).toBeNull();
      } else {
        expect(await menuItems()).toEqual(actions);
      }
    },
  );

  it("shows its actions only once its menu is opened", () => {
    setup();

    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(menuButton()).toBeInTheDocument();
  });

  it("opens a correction on Korrigieren, without annulling", async () => {
    const props = setup();

    await menuItems();
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Korrigieren" }),
    );

    expect(props.onOpenCorrection).toHaveBeenCalledOnce();
    expect(props.onOpenAnnulConfirmation).not.toHaveBeenCalled();
  });

  it("asks to annul on Annullieren …, without correcting", async () => {
    const props = setup();

    await menuItems();
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Annullieren …" }),
    );

    expect(props.onOpenAnnulConfirmation).toHaveBeenCalledOnce();
    expect(props.onOpenCorrection).not.toHaveBeenCalled();
  });

  it("shows an open correction in place of its menu", () => {
    setup({}, <p>Korrekturformular</p>);

    expect(screen.getByText("Korrekturformular")).toBeInTheDocument();
    expect(menuButton()).toBeNull();
  });

  it.each(["manuell", "gesamtstärke-gemeldet"] as const)(
    "shows an annulled %s entry struck through, header and text, keeping its number and offering no actions",
    (type) => {
      setup({
        ...ROUTED,
        type,
        number: 4,
        state: "annulliert",
        text: "Fehleintrag",
        editedAt: "2026-07-03T09:30:00.000Z",
      });

      expect(struck("Fehleintrag")).toBeInTheDocument();
      expect(struck("Von UHSt 2 an EAL · Funk")).toBeInTheDocument();
      expect(screen.getByText("#4")).toBeInTheDocument();
      expect(menuButton()).toBeNull();
      expect(screen.queryByText(/korrigiert/)).toBeNull();
    },
  );

  it("shows an earlier Fassung struck through, header and text, with its author and time", () => {
    setup({
      ...ROUTED,
      text: "Deich hält nicht",
      channel: "Telefon",
      author: "bernd",
      editedAt: "2026-07-03T09:00:00.000Z",
      revisions: [
        {
          text: "Deich hält",
          author: "anna",
          createdAt: "2026-07-03T08:00:00.000Z",
          ...ROUTED,
        },
      ],
    });

    expect(struck("Von UHSt 2 an EAL · Funk")).toBeInTheDocument();
    expect(struck("Deich hält")).toBeInTheDocument();
    expect(screen.getByText(/–\s*anna, 03\.07\.26, 10:00/)).toBeInTheDocument();
    expect(screen.getByText("Deich hält nicht").closest("del")).toBeNull();
  });

  it("gives earlier Fassungen with the same time distinct keys", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sameTs = "2026-07-03T08:00:00.000Z";
    setup({
      text: "Fassung 3",
      revisions: [
        { text: "Fassung 1", author: "anna", createdAt: sameTs, ...NO_ROUTE },
        { text: "Fassung 2", author: "bernd", createdAt: sameTs, ...NO_ROUTE },
      ],
    });

    expect(screen.getByText("Fassung 1")).toBeInTheDocument();
    expect(screen.getByText("Fassung 2")).toBeInTheDocument();
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
    errorSpy.mockRestore();
  });

  it("shows when a corrected entry was corrected", () => {
    setup({ editedAt: "2026-07-03T09:30:00.000Z" });

    expect(screen.getByText("korrigiert 03.07.26, 11:30")).toBeInTheDocument();
  });
});
