import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { MainViewBar } from "./MainViewBar";

describe("MainViewBar", () => {
  it("marks the active view and reports a selection", async () => {
    const onSelect = vi.fn();
    render(<MainViewBar activeView="etb" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: "ETB" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "Lagekarte" }),
    ).not.toHaveAttribute("aria-current");

    await userEvent.click(screen.getByRole("button", { name: "Lagekarte" }));
    expect(onSelect).toHaveBeenCalledWith("map");
  });

  it("marks neither item as current before the start view is known", () => {
    render(<MainViewBar activeView="default" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "ETB" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("button", { name: "Lagekarte" }),
    ).not.toHaveAttribute("aria-current");
  });
});
