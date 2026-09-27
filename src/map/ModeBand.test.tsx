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
  });
});
