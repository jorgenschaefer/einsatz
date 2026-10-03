import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

let exit: ReturnType<typeof vi.spyOn>;
let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("server start-up", () => {
  it("stops in production without a MapTiler key and logs why", async () => {
    vi.stubEnv("MAPTILER_API_KEY", "");
    await register();
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(logged.mock.calls[0])).toMatch(/MAPTILER_API_KEY/);
  });

  it("starts in production with a MapTiler key", async () => {
    vi.stubEnv("MAPTILER_API_KEY", "test-key");
    await register();
    expect(exit).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it("starts in development without a key, falling back to OSM", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MAPTILER_API_KEY", "");
    await register();
    expect(exit).not.toHaveBeenCalled();
  });

  it("leaves runtimes other than Node.js alone, where process.exit does not exist", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("MAPTILER_API_KEY", "");
    await register();
    expect(exit).not.toHaveBeenCalled();
  });
});
