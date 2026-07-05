import { describe, expect, it } from "vitest";
import { RateGate } from "./geocoder";

describe("RateGate", () => {
  it("allows the first call and blocks calls within the interval", () => {
    const gate = new RateGate(1000);
    expect(gate.tryAcquire(0)).toBe(true);
    expect(gate.tryAcquire(500)).toBe(false);
    expect(gate.tryAcquire(999)).toBe(false);
    expect(gate.tryAcquire(1000)).toBe(true);
    expect(gate.tryAcquire(1500)).toBe(false);
  });
});
