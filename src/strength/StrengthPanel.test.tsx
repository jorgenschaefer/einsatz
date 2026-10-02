import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { notificationArea, screen, within } from "@/test/render";
import {
  card,
  minutesAfterReport,
  openCreateField,
  openRenameField,
  report,
  setup,
  strength,
} from "./StrengthPanel.fixtures";

describe("StrengthPanel", () => {
  it("shows a card for each Stelle, in the given order", () => {
    setup();

    expect(
      Array.from(document.querySelectorAll("[data-station]")).map(
        (el) => within(el as HTMLElement).getByRole("heading").textContent,
      ),
    ).toEqual(["UHSt 3", "Ziel"]);
  });

  describe("creating a Stelle", () => {
    it("creates it with the typed name and closes the field", async () => {
      const { onCreateStation } = setup();

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(onCreateStation).toHaveBeenCalledWith("UHSt 4");
      expect(
        screen.queryByRole("textbox", { name: "Name der Stelle" }),
      ).toBeNull();
    });

    it("creates it on Enter", async () => {
      const { onCreateStation } = setup();

      await userEvent.type(await openCreateField(), "UHSt 4{Enter}");

      expect(onCreateStation).toHaveBeenCalledWith("UHSt 4");
    });

    it("shows a returned error at the field and keeps the typed name", async () => {
      setup({
        onCreateStation: vi.fn(async () => ({
          error: "Eine Stelle mit diesem Namen gibt es schon.",
        })),
      });

      await userEvent.type(await openCreateField(), "uhst 3");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      const field = screen.getByRole("textbox", { name: "Name der Stelle" });
      expect(field).toHaveAccessibleDescription(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      expect(notificationArea()).not.toContainElement(alert);
      expect(field).toHaveValue("uhst 3");
    });

    it("shows a failed save as an error at the field", async () => {
      setup({
        onCreateStation: vi.fn(async () => {
          throw new Error("offline");
        }),
      });

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
      ).toHaveAccessibleDescription(
        "Speichern fehlgeschlagen. Bitte erneut versuchen.",
      );
    });

    it("discards the typed name on Abbrechen", async () => {
      const { onCreateStation } = setup();

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onCreateStation).not.toHaveBeenCalled();
      expect(await openCreateField()).toHaveValue("");
    });
  });

  describe("renaming a Stelle", () => {
    it("starts from the current name and saves the new one", async () => {
      const { onRenameStation } = setup();

      const field = await openRenameField("UHSt 3");
      expect(field).toHaveValue("UHSt 3");
      await userEvent.type(field, " Nord");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(onRenameStation).toHaveBeenCalledWith("s1", "UHSt 3 Nord");
      expect(screen.queryByRole("textbox", { name: "Neuer Name" })).toBeNull();
    });

    it("shows a returned error at the field and keeps it open", async () => {
      setup({
        onRenameStation: vi.fn(async () => ({
          error: "Eine Stelle mit diesem Namen gibt es schon.",
        })),
      });

      const field = await openRenameField("UHSt 3");
      await userEvent.clear(field);
      await userEvent.type(field, "Ziel");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(field).toHaveAccessibleDescription(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      expect(field).toHaveValue("Ziel");
    });

    it("keeps the name on Abbrechen", async () => {
      const { onRenameStation } = setup();

      const field = await openRenameField("UHSt 3");
      await userEvent.type(field, " Nord");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onRenameStation).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox", { name: "Neuer Name" })).toBeNull();
      expect(card("UHSt 3")).toBeInTheDocument();
    });
  });

  describe("the card of a Stelle", () => {
    it("shows its latest valid report with time and note", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report(),
              report({
                crew: 9,
                number: 3,
                reportedAt: "2026-09-26T08:00:00.000Z",
              }),
            ],
          },
        ],
      });

      const item = card("UHSt 3");
      expect(within(item).getByText(strength("0/1/6/7"))).toBeInTheDocument();
      expect(within(item).getByText("+2 zusätzlich")).toBeInTheDocument();
      expect(within(item).getByText("9 Personen")).toBeInTheDocument();
      expect(
        within(item).getByText("2 einsatzbereite Streifen"),
      ).toBeInTheDocument();
      expect(within(item).getByText("11:01")).toBeInTheDocument();
    });

    it("skips an annulled latest report", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({ crew: 4, number: 3 }),
              report({ crew: 9, number: 4, state: "annulliert" }),
            ],
          },
        ],
      });

      expect(
        within(card("UHSt 3")).getByText(strength("0/1/4/5")),
      ).toBeInTheDocument();
    });

    it("highlights its time once the report is older than 60 minutes", () => {
      const { rerender } = setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
        now: minutesAfterReport(60),
      });
      const time = () => within(card("UHSt 3")).getByText("11:01");
      expect(time()).not.toHaveAttribute("data-stale");

      rerender({ now: minutesAfterReport(60) + 1 });

      expect(time()).toHaveAttribute("data-stale");
    });

    it("never highlights the time of a report of 0 Personen", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({
                leaders: 0,
                subLeaders: 0,
                crew: 0,
                additionalPersonnel: 0,
              }),
            ],
          },
        ],
        now: minutesAfterReport(600),
      });

      expect(within(card("UHSt 3")).getByText("11:01")).not.toHaveAttribute(
        "data-stale",
      );
    });

    it("shows „noch keine Meldung“ without a valid report", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [report({ state: "annulliert" })],
          },
          { id: "s2", name: "Ziel", reports: [] },
        ],
      });

      expect(
        within(card("UHSt 3")).getByText("noch keine Meldung"),
      ).toBeInTheDocument();
      expect(
        within(card("Ziel")).getByText("noch keine Meldung"),
      ).toBeInTheDocument();
    });
  });
});
