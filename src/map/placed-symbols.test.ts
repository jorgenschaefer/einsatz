import { describe, expect, it } from "vitest";
import { type StatefulSymbol, toPlacedSymbols } from "./placed-symbols";

const NOW = new Date("2026-07-04T12:00:00Z").getTime();

const symbol = (over: Partial<StatefulSymbol> = {}): StatefulSymbol => ({
  id: "s1",
  lat: 53.55,
  lng: 9.99,
  composition: { grundzeichen: "ortsfeste-stelle", organisation: "feuerwehr" },
  positionSource: "manual",
  reportedAt: null,
  ...over,
});

describe("toPlacedSymbols", () => {
  it("renders an icon data URL and keeps position", () => {
    const [placed] = toPlacedSymbols([symbol()], NOW);
    expect(placed).toMatchObject({ id: "s1", lat: 53.55, lng: 9.99 });
    expect(placed.iconUrl).toMatch(/^data:/);
  });

  it("exposes the Bezeichnung (text) as the marker label", () => {
    const [withText] = toPlacedSymbols(
      [
        symbol({
          composition: { grundzeichen: "ortsfeste-stelle", text: "83/1" },
        }),
      ],
      NOW,
    );
    expect(withText.label).toBe("83/1");
    const [withoutText] = toPlacedSymbols([symbol()], NOW);
    expect(withoutText.label).toBeUndefined();
  });

  it("shows a manual symbol at full opacity", () => {
    const [placed] = toPlacedSymbols(
      [symbol({ positionSource: "manual" })],
      NOW,
    );
    expect(placed.opacity).toBe(1);
  });

  it("dims a stale device symbol and keeps a fresh one full", () => {
    const stale = symbol({
      id: "old",
      positionSource: "device",
      reportedAt: new Date(NOW - 10 * 60 * 1000),
    });
    const fresh = symbol({
      id: "new",
      positionSource: "device",
      reportedAt: new Date(NOW - 30 * 1000),
    });
    const [placedStale, placedFresh] = toPlacedSymbols([stale, fresh], NOW);
    expect(placedStale.opacity).toBe(0.4);
    expect(placedFresh.opacity).toBe(1);
  });
});
