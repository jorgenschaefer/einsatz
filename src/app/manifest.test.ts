import { describe, expect, it } from "vitest";
import manifest from "./manifest";
import { PRIMARY_COLOR } from "./theme";

describe("web app manifest", () => {
  it("is installable in standalone display with a name and an icon", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.name).toMatch(/lageführung/i);
    expect(m.start_url).toBeTruthy();
    expect((m.icons ?? []).length).toBeGreaterThan(0);
  });

  it("uses the app's primary colour as theme colour", () => {
    expect(manifest().theme_color).toBe(PRIMARY_COLOR);
  });
});
