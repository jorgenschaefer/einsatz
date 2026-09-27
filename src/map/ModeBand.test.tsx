import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { ModeBand } from "./ModeBand";

describe("ModeBand", () => {
  it("names the mode and ends it with its one button", async () => {
    const onAction = vi.fn();
    render(
      <ModeBand
        label="Bereich zeichnen"
        actionLabel="Abbrechen"
        onAction={onAction}
      />,
    );
    const band = screen.getByRole("toolbar", { name: "Bereich zeichnen" });
    expect(band).toHaveTextContent("Bereich zeichnen");
    await userEvent.click(
      within(band).getByRole("button", { name: "Abbrechen" }),
    );
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(within(band).getAllByRole("button")).toHaveLength(1);
  });

  it("renders a confirm button before the action when given", async () => {
    const onConfirm = vi.fn();
    render(
      <ModeBand
        label="Kreis verschieben"
        confirm={{ label: "Hier setzen", onClick: onConfirm }}
        actionLabel="Abbrechen"
        onAction={vi.fn()}
      />,
    );
    const band = screen.getByRole("toolbar", { name: "Kreis verschieben" });
    const buttons = within(band).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Hier setzen",
      "Abbrechen",
    ]);
    await userEvent.click(buttons[0]);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while busy", () => {
    render(
      <ModeBand
        label="Kreis verschieben"
        confirm={{ label: "Hier setzen", onClick: vi.fn() }}
        actionLabel="Abbrechen"
        onAction={vi.fn()}
        busy
      />,
    );
    expect(screen.getByRole("button", { name: "Hier setzen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
  });
});
