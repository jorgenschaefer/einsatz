import { describe, expect, it } from "vitest";
import {
  type SearchableSymbol,
  searchOperationObjects,
  shouldGeocode,
} from "./search";

describe("shouldGeocode", () => {
  it("suppresses queries shorter than 3 characters (after trim)", () => {
    expect(shouldGeocode("ha")).toBe(false);
    expect(shouldGeocode("  ha  ")).toBe(false);
    expect(shouldGeocode("ham")).toBe(true);
  });
});

const symbols: SearchableSymbol[] = [
  {
    id: "s1",
    composition: { text: "Rotkreuz Musterstadt 83/1" },
    lat: 1,
    lng: 2,
  },
  { id: "s2", composition: {}, lat: 3, lng: 4 },
];

describe("searchOperationObjects", () => {
  it("returns nothing for an empty query", () => {
    expect(searchOperationObjects("  ", symbols)).toEqual([]);
  });

  it("matches a Kartenzeichen by Bezeichnung, case-insensitive substring", () => {
    const results = searchOperationObjects("musterstadt", symbols);
    expect(results).toContainEqual({
      id: "s1",
      label: "Rotkreuz Musterstadt 83/1",
      lat: 1,
      lng: 2,
    });
  });

  it("does not match a Kartenzeichen without a Bezeichnung", () => {
    expect(
      searchOperationObjects("83", symbols).some((r) => r.id === "s2"),
    ).toBe(false);
  });
});
