import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { toPlacedSymbols } from "./placed-symbols";
import { QUICK_SELECT } from "./quick-select";
import { SymbolsPanel } from "./SymbolsPanel";
import { aSymbol } from "./symbol.fixtures";

const PUMP = aSymbol({
  composition: {
    grundzeichen: "taktische-formation",
    organisation: "hilfsorganisation",
    text: "Rotkreuz 83/1",
  },
});

function renderPanel(over: Partial<ComponentProps<typeof SymbolsPanel>> = {}) {
  const symbols = over.symbols ?? [];
  const props = {
    symbols,
    placed: toPlacedSymbols(symbols, Date.now()),
    armedQuickId: null,
    onArmQuick: vi.fn(),
    onOpenAdvanced: vi.fn(),
    onJump: vi.fn(),
    onEdit: vi.fn(),
    ...over,
  };
  render(<SymbolsPanel {...props} />);
  return props;
}

describe("SymbolsPanel", () => {
  it("shows an empty hint when no Kartenzeichen are placed", () => {
    renderPanel();
    expect(
      screen.getByText(
        "Noch keine Kartenzeichen. Zeichen wählen und auf die Karte tippen.",
      ),
    ).toBeInTheDocument();
  });

  it("arms a Schnellauswahl symbol and opens Erweitert", async () => {
    const { onArmQuick, onOpenAdvanced } = renderPanel();
    const [first] = QUICK_SELECT;

    await userEvent.click(screen.getByRole("button", { name: first.label }));
    expect(onArmQuick).toHaveBeenCalledWith(first.id);
    await userEvent.click(screen.getByText("Erweitert …"));
    expect(onOpenAdvanced).toHaveBeenCalled();
  });

  it("marks the armed Schnellauswahl symbol", () => {
    const [first, second] = QUICK_SELECT;
    renderPanel({ armedQuickId: second.id });
    expect(screen.getByRole("button", { name: second.label })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: first.label })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("badges a fresh device symbol as live, a stale one as veraltet and a manual one not at all", () => {
    const comp = {
      grundzeichen: "ortsfeste-stelle" as const,
      organisation: "hilfsorganisation" as const,
    };
    renderPanel({
      symbols: [
        aSymbol({
          id: "fresh",
          lat: 1,
          lng: 2,
          composition: comp,
          positionSource: "device",
          reportedAt: new Date(Date.now() - 10 * 1000),
        }),
        aSymbol({
          id: "stale",
          lat: 3,
          lng: 4,
          composition: { ...comp, text: "THW 1" },
          positionSource: "device",
          reportedAt: new Date(Date.now() - 4 * 60 * 1000),
        }),
        PUMP,
      ],
    });
    const row = (name: string) =>
      screen.getByText(name).closest("button") as HTMLElement;

    expect(row("Ohne Bezeichnung")).toHaveTextContent("live");
    expect(row("THW 1")).toHaveTextContent("veraltet");
    expect(row("THW 1")).not.toHaveTextContent("live");
    expect(row("Rotkreuz 83/1")).toHaveTextContent(/^Rotkreuz 83\/1$/);
  });

  it("shows the icon of the marker in the row", () => {
    const { placed } = renderPanel({ symbols: [PUMP] });
    const row = screen.getByText("Rotkreuz 83/1").closest("button");
    expect(row?.querySelector("img")).toHaveAttribute("src", placed[0].iconUrl);
  });

  it("jumps to a Kartenzeichen from its row and edits it from the pencil", async () => {
    const { onJump, onEdit } = renderPanel({ symbols: [PUMP] });

    await userEvent.click(screen.getByText("Rotkreuz 83/1"));
    expect(onJump).toHaveBeenCalledWith(53.5, 9.9);
    expect(onEdit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText("Rotkreuz 83/1 bearbeiten"));
    expect(onEdit).toHaveBeenCalledWith("s1");
  });
});
