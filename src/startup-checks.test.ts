import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refuseToStartWithoutTiles } from "./startup-checks";

let exit: ReturnType<typeof vi.spyOn>;
let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("refuseToStartWithoutTiles", () => {
  it("stops in production without a MapTiler key and logs why", () => {
    vi.stubEnv("MAPTILER_API_KEY", "");
    refuseToStartWithoutTiles();
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(logged.mock.calls[0])).toMatch(/MAPTILER_API_KEY/);
  });

  it("starts in production with a MapTiler key", () => {
    vi.stubEnv("MAPTILER_API_KEY", "test-key");
    refuseToStartWithoutTiles();
    expect(exit).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });
});
