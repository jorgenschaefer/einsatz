import { describe, expect, it } from "vitest";
import { chooseInitialView, FALLBACK_VIEW, type MapView } from "./view";

const local: MapView = { lat: 1, lng: 2, zoom: 12 };
const dflt: MapView = { lat: 3, lng: 4, zoom: 10 };

describe("chooseInitialView", () => {
  it("prefers the local last view over the operation default", () => {
    expect(chooseInitialView(local, dflt)).toEqual(local);
  });

  it("falls back to the operation default when there is no local view", () => {
    expect(chooseInitialView(null, dflt)).toEqual(dflt);
  });

  it("falls back to the fixed fallback when neither exists", () => {
    expect(chooseInitialView(null, null)).toEqual(FALLBACK_VIEW);
  });
});
