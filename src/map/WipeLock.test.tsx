import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { WipeLock } from "./WipeLock";

describe("WipeLock", () => {
  it("covers the screen with an unlock control", () => {
    render(<WipeLock onUnlock={vi.fn()} />);
    expect(screen.getByTestId("wipe-lock-overlay")).toBeInTheDocument();
    expect(screen.getByLabelText(/entsperren/i)).toBeInTheDocument();
  });

  it("renders the overlay in a portal, outside its parent DOM subtree", () => {
    render(
      <div data-testid="host">
        <WipeLock onUnlock={vi.fn()} />
      </div>,
    );
    const overlay = screen.getByTestId("wipe-lock-overlay");
    // Im Portal auf oberster Ebene → nicht mehr im Elternbaum der Ansicht,
    // sodass die Sperre garantiert über allen Bedienelementen liegt.
    expect(screen.getByTestId("host")).not.toContainElement(overlay);
    expect(document.body).toContainElement(overlay);
  });

  it("unlocks only when the swipe control is dragged all the way", () => {
    const onUnlock = vi.fn();
    render(<WipeLock onUnlock={onUnlock} />);
    const slider = screen.getByLabelText(/entsperren/i);

    fireEvent.change(slider, { target: { value: "60" } });
    expect(onUnlock).not.toHaveBeenCalled(); // nur teilweise gewischt

    fireEvent.change(slider, { target: { value: "100" } });
    expect(onUnlock).toHaveBeenCalled();
  });
});
