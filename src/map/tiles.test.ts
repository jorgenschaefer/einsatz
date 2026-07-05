import { afterEach, describe, expect, it } from "vitest";
import { mapTileConfig } from "./tiles";

const original = process.env.MAPTILER_API_KEY;
afterEach(() => {
  process.env.MAPTILER_API_KEY = original;
});

describe("mapTileConfig", () => {
  it("uses public OSM tiles when no MapTiler key is set, with OSM attribution", () => {
    delete process.env.MAPTILER_API_KEY;
    const config = mapTileConfig();
    expect(config.tileUrl).toContain("tile.openstreetmap.org");
    expect(config.attribution).toMatch(/OpenStreetMap/);
  });

  it("uses MapTiler tiles when a key is set, still crediting OSM", () => {
    process.env.MAPTILER_API_KEY = "test-key";
    const config = mapTileConfig();
    expect(config.tileUrl).toContain("api.maptiler.com");
    expect(config.tileUrl).toContain("key=test-key");
    expect(config.attribution).toMatch(/OpenStreetMap/);
  });
});
