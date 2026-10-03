import { afterEach, describe, expect, it, vi } from "vitest";
import { mapTileConfig } from "./tiles";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mapTileConfig", () => {
  it("uses public OSM tiles in development when no MapTiler key is set, with OSM attribution", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MAPTILER_API_KEY", "");
    const config = mapTileConfig();
    expect(config.tileUrl).toContain("tile.openstreetmap.org");
    expect(config.attribution).toMatch(/OpenStreetMap/);
  });

  it("uses MapTiler tiles when a key is set, still crediting OSM", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAPTILER_API_KEY", "test-key");
    const config = mapTileConfig();
    expect(config.tileUrl).toContain("api.maptiler.com");
    expect(config.tileUrl).toContain("key=test-key");
    expect(config.attribution).toMatch(/OpenStreetMap/);
  });

  it.each([
    ["empty", ""],
    ["absent", undefined],
  ])(
    "refuses to fall back to OSM tiles in production, naming the missing key (%s)",
    (_kind, key) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("MAPTILER_API_KEY", key);
      expect(() => mapTileConfig()).toThrow(
        /MAPTILER_API_KEY.*(Produktion|production)/i,
      );
    },
  );
});
