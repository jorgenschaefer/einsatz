import { describe, expect, it } from "vitest";
import { isStale, STALE_AFTER_MS } from "./staleness";

const now = new Date("2026-07-03T12:00:00Z").getTime();
const ago = (ms: number) => new Date(now - ms);

describe("isStale", () => {
  it("marks a device symbol whose last report is older than 3 minutes as stale", () => {
    expect(isStale("device", ago(STALE_AFTER_MS + 1000), now)).toBe(true);
  });

  it("keeps a freshly reporting device symbol not stale", () => {
    expect(isStale("device", ago(STALE_AFTER_MS - 1000), now)).toBe(false);
  });

  it("never marks a manually placed symbol as stale, however old", () => {
    expect(isStale("manual", ago(STALE_AFTER_MS * 10), now)).toBe(false);
    expect(isStale("manual", null, now)).toBe(false);
  });

  it("is not stale when a device symbol has never reported", () => {
    expect(isStale("device", null, now)).toBe(false);
  });
});
