import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { MapPanelSwitch } from "./MapPanelSwitch";

const entries = () =>
  screen
    .getAllByRole("button")
    .map((button) => [
      button.getAttribute("aria-label"),
      button.getAttribute("aria-pressed"),
    ]);

describe("MapPanelSwitch", () => {
  it("lists the panels in a group and marks the shown one", () => {
    render(<MapPanelSwitch shownPanel="areas" onSelect={vi.fn()} />);
    expect(
      screen.getByRole("group", { name: "Kartenpanels" }),
    ).toBeInTheDocument();
    expect(entries()).toEqual([
      ["Kartenzeichen", "false"],
      ["Bereiche", "true"],
      ["Ebenen", "false"],
    ]);
  });

  it("marks no entry while no panel is shown", () => {
    render(<MapPanelSwitch shownPanel={null} onSelect={vi.fn()} />);
    expect(entries().map(([, pressed]) => pressed)).toEqual([
      "false",
      "false",
      "false",
    ]);
  });

  it("shows each entry's name as its text", () => {
    render(<MapPanelSwitch shownPanel={null} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Kartenzeichen",
      "Bereiche",
      "Ebenen",
    ]);
  });

  it("reports the tapped entry", async () => {
    const onSelect = vi.fn();
    render(<MapPanelSwitch shownPanel={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Ebenen" }));
    expect(onSelect).toHaveBeenCalledWith("layers");
  });
});
