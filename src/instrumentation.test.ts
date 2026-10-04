import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

let exit: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("server start-up", () => {
  it("runs the start-up checks in Node.js", async () => {
    vi.stubEnv("MAPTILER_API_KEY", "");
    await register();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("leaves runtimes other than Node.js alone, where process.exit does not exist", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("MAPTILER_API_KEY", "");
    await register();
    expect(exit).not.toHaveBeenCalled();
  });
});
