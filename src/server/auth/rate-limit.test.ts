import { describe, expect, it } from "vitest";
import { LoginRateLimiter } from "./rate-limit";

describe("LoginRateLimiter", () => {
  it("blocks after the configured number of failures within the window", () => {
    const limiter = new LoginRateLimiter(3, 1000);
    expect(limiter.isBlocked("anna", 0)).toBe(false);
    limiter.recordFailure("anna", 0);
    limiter.recordFailure("anna", 100);
    expect(limiter.isBlocked("anna", 200)).toBe(false);
    limiter.recordFailure("anna", 200);
    expect(limiter.isBlocked("anna", 300)).toBe(true);
  });

  it("forgets failures older than the window", () => {
    const limiter = new LoginRateLimiter(2, 1000);
    limiter.recordFailure("anna", 0);
    limiter.recordFailure("anna", 100);
    expect(limiter.isBlocked("anna", 200)).toBe(true);
    expect(limiter.isBlocked("anna", 1200)).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = new LoginRateLimiter(1, 1000);
    limiter.recordFailure("anna", 0);
    expect(limiter.isBlocked("anna", 0)).toBe(true);
    expect(limiter.isBlocked("bob", 0)).toBe(false);
  });

  it("reset clears a key after a successful login", () => {
    const limiter = new LoginRateLimiter(1, 1000);
    limiter.recordFailure("anna", 0);
    limiter.reset("anna");
    expect(limiter.isBlocked("anna", 0)).toBe(false);
  });
});
