import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { AreasPanel } from "./AreasPanel";
import type { RenderedArea } from "./SituationMap";

const CIRCLE: RenderedArea = {
  id: "a1",
  geometry: { shape: "circle", center: { lat: 53.5, lng: 9.9 }, radius: 100 },
  color: "#e2001a",
  opacity: 0.4,
  label: "Deich",
};

const LINE: RenderedArea = {
  id: "a2",
  geometry: {
    shape: "line",
    points: [
      { lat: 1, lng: 1 },
      { lat: 3, lng: 5 },
    ],
  },
  color: "#0000ff",
  opacity: 0.4,
  label: "",
};

function renderPanel(over: Partial<ComponentProps<typeof AreasPanel>> = {}) {
  const props = {
    areas: [],
    drawShape: null,
    onToggleDraw: vi.fn(),
    onJump: vi.fn(),
    onEdit: vi.fn(),
    ...over,
  };
  render(<AreasPanel {...props} />);
  return props;
}

const row = (name: string) =>
  screen.getByText(name).closest("button") as HTMLElement;

describe("AreasPanel", () => {
  it("shows an empty hint when there are no Bereiche", () => {
    renderPanel();
    expect(
      screen.getByText(
        "Noch keine Bereiche. Form wählen und auf die Karte zeichnen.",
      ),
    ).toBeInTheDocument();
  });

  it("marks the shape being drawn as pressed and toggles a shape on click", async () => {
    const { onToggleDraw } = renderPanel({ drawShape: "line" });

    expect(screen.getByRole("button", { name: "Linie" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Kreis" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    for (const name of ["Polygon", "Linie", "Kreis"]) {
      await userEvent.click(screen.getByRole("button", { name }));
    }
    expect(onToggleDraw).toHaveBeenNthCalledWith(1, "polygon");
    expect(onToggleDraw).toHaveBeenNthCalledWith(2, "line");
    expect(onToggleDraw).toHaveBeenNthCalledWith(3, "circle");
  });

  it("lists each Bereich with its colour and shape, unlabelled ones as Bereich", () => {
    renderPanel({ areas: [CIRCLE, LINE] });

    expect(row("Deich")).toHaveTextContent("Kreis");
    expect(row("Deich").querySelector("[style*=background]")).toHaveStyle({
      background: "#e2001a",
    });
    expect(row("Bereich")).toHaveTextContent("Linie");
  });

  it("jumps to the centre of a Bereich from its row", async () => {
    const { onJump, onEdit } = renderPanel({ areas: [LINE] });
    await userEvent.click(row("Bereich"));
    expect(onJump).toHaveBeenCalledWith(2, 3);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("edits a Bereich from the pencil", async () => {
    const { onEdit } = renderPanel({ areas: [CIRCLE] });
    await userEvent.click(screen.getByLabelText("Deich bearbeiten"));
    expect(onEdit).toHaveBeenCalledWith("a1");
  });

  it("offers no copying of a Bereich", () => {
    renderPanel({ areas: [CIRCLE, LINE] });
    expect(screen.getAllByRole("button", { name: /bearbeiten/ })).toHaveLength(
      2,
    );
    expect(screen.queryByRole("button", { name: /kopieren/ })).toBeNull();
  });
});
