import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import {
  type QuickSelectButton,
  QuickSelectToolbar,
} from "./QuickSelectToolbar";

const items: QuickSelectButton[] = [
  { id: "ktw", label: "KTW", iconUrl: "data:svg1" },
  { id: "nef", label: "NEF", iconUrl: "data:svg2" },
];

describe("QuickSelectToolbar", () => {
  it("renders a button per item", () => {
    render(<QuickSelectToolbar items={items} armedId={null} onArm={vi.fn()} />);
    expect(screen.getByRole("button", { name: /KTW/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /NEF/ })).toBeInTheDocument();
  });

  it("arms an item when clicked", async () => {
    const onArm = vi.fn();
    render(<QuickSelectToolbar items={items} armedId={null} onArm={onArm} />);
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
    expect(onArm).toHaveBeenCalledWith("ktw");
  });

  it("marks the armed item as pressed and disarms it on a second click", async () => {
    const onArm = vi.fn();
    render(<QuickSelectToolbar items={items} armedId="ktw" onArm={onArm} />);
    expect(screen.getByRole("button", { name: /KTW/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
    expect(onArm).toHaveBeenCalledWith(null);
  });
});
