import { beforeEach, describe, expect, it } from "vitest";
import { readLastView, writeLastView } from "./last-view-storage";
import type { MapView } from "./view";

const view: MapView = { lat: 53.55, lng: 9.99, zoom: 13 };

describe("last-view storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a view for an operation", () => {
    writeLastView("op-1", view);
    expect(readLastView("op-1")).toEqual(view);
  });

  it("returns null when nothing is stored", () => {
    expect(readLastView("op-1")).toBeNull();
  });

  it("keeps views separate per operation", () => {
    writeLastView("op-1", view);
    expect(readLastView("op-2")).toBeNull();
  });

  it("returns null for corrupted storage instead of throwing", () => {
    localStorage.setItem("s2:lastView:op-1", "not json");
    expect(readLastView("op-1")).toBeNull();
  });
});
