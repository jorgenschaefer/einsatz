import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { StrengthPanel, type StrengthPanelProps } from "./StrengthPanel";

function setup(over: Partial<StrengthPanelProps> = {}) {
  const props: StrengthPanelProps = {
    stations: [
      { id: "s1", name: "UHSt 3" },
      { id: "s2", name: "Ziel" },
    ],
    onCreateStation: vi.fn(async () => ({})),
    onRenameStation: vi.fn(async () => ({})),
    ...over,
  };
  render(<StrengthPanel {...props} />);
  return props;
}

const card = (name: string) =>
  screen.getByText(name).closest("[data-station]") as HTMLElement;

async function openCreateField() {
  await userEvent.click(screen.getByRole("button", { name: "+ Stelle" }));
  return screen.getByRole("textbox", { name: "Name der Stelle" });
}

async function openRenameField(name: string) {
  await userEvent.click(
    within(card(name)).getByRole("button", { name: `${name} umbenennen` }),
  );
  return screen.getByRole("textbox", { name: "Neuer Name" });
}

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

    it("shows a returned error and keeps the typed name", async () => {
      setup({
        onCreateStation: vi.fn(async () => ({
          error: "Eine Stelle mit diesem Namen gibt es schon.",
        })),
      });

      await userEvent.type(await openCreateField(), "uhst 3");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      expect(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
      ).toHaveValue("uhst 3");
    });

    it("shows a failed save as an error", async () => {
      setup({
        onCreateStation: vi.fn(async () => {
          throw new Error("offline");
        }),
      });

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
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

    it("shows a returned error and keeps the field open", async () => {
      setup({
        onRenameStation: vi.fn(async () => ({
          error: "Eine Stelle mit diesem Namen gibt es schon.",
        })),
      });

      const field = await openRenameField("UHSt 3");
      await userEvent.clear(field);
      await userEvent.type(field, "Ziel");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      expect(screen.getByRole("textbox", { name: "Neuer Name" })).toHaveValue(
        "Ziel",
      );
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
});
