import { describe, expect, it } from "vitest";
import { LoginRateLimiter } from "./rate-limit";

describe("LoginRateLimiter – pair counter (ip:username)", () => {
  it("blocks after the configured number of pair failures within the window", () => {
    const limiter = new LoginRateLimiter(3, 100, 1000);
    expect(limiter.isBlocked("ip-a", "anna", 0)).toBe(false);
    limiter.recordFailure("ip-a", "anna", 0);
    limiter.recordFailure("ip-a", "anna", 100);
    expect(limiter.isBlocked("ip-a", "anna", 200)).toBe(false);
    limiter.recordFailure("ip-a", "anna", 200);
    expect(limiter.isBlocked("ip-a", "anna", 300)).toBe(true);
  });

  it("forgets pair failures older than the window", () => {
    const limiter = new LoginRateLimiter(2, 100, 1000);
    limiter.recordFailure("ip-a", "anna", 0);
    limiter.recordFailure("ip-a", "anna", 100);
    expect(limiter.isBlocked("ip-a", "anna", 200)).toBe(true);
    expect(limiter.isBlocked("ip-a", "anna", 1200)).toBe(false);
  });

  it("tracks (ip, username) pairs independently", () => {
    const limiter = new LoginRateLimiter(1, 100, 1000);
    limiter.recordFailure("ip-a", "anna", 0);
    expect(limiter.isBlocked("ip-a", "anna", 0)).toBe(true);
    expect(limiter.isBlocked("ip-a", "bob", 0)).toBe(false);
  });

  it("resetPair clears only the pair after a successful login", () => {
    const limiter = new LoginRateLimiter(1, 100, 1000);
    limiter.recordFailure("ip-a", "anna", 0);
    limiter.resetPair("ip-a", "anna");
    expect(limiter.isBlocked("ip-a", "anna", 0)).toBe(false);
  });
});

describe("LoginRateLimiter – IP counter (spraying)", () => {
  it("blocks the IP after enough failures spread across many usernames", () => {
    // Pair budget 5, IP budget 3: three failures against three distinct names
    // never trip a pair, but do exhaust the IP budget.
    const limiter = new LoginRateLimiter(5, 3, 1000);
    limiter.recordFailure("ip-a", "u1", 0);
    limiter.recordFailure("ip-a", "u2", 0);
    limiter.recordFailure("ip-a", "u3", 0);
    // Even a so-far-unused username from this IP is now blocked.
    expect(limiter.isBlocked("ip-a", "fresh", 0)).toBe(true);
  });

  it("keeps IPs isolated: exhausting IP A does not block IP B", () => {
    const limiter = new LoginRateLimiter(5, 3, 1000);
    limiter.recordFailure("ip-a", "u1", 0);
    limiter.recordFailure("ip-a", "u2", 0);
    limiter.recordFailure("ip-a", "u3", 0);
    expect(limiter.isBlocked("ip-a", "u4", 0)).toBe(true);
    expect(limiter.isBlocked("ip-b", "u1", 0)).toBe(false);
  });

  it("forgets IP failures older than the window", () => {
    const limiter = new LoginRateLimiter(5, 2, 1000);
    limiter.recordFailure("ip-a", "u1", 0);
    limiter.recordFailure("ip-a", "u2", 100);
    expect(limiter.isBlocked("ip-a", "u3", 200)).toBe(true);
    expect(limiter.isBlocked("ip-a", "u3", 1200)).toBe(false);
  });

  it("resetPair does NOT clear the IP counter (a valid account cannot drain the IP budget)", () => {
    // IP budget 2 reached across two names; the attacker owns 'u2' and logs in.
    const limiter = new LoginRateLimiter(5, 2, 60_000);
    limiter.recordFailure("ip-a", "u1", 0);
    limiter.recordFailure("ip-a", "u2", 0);
    expect(limiter.isBlocked("ip-a", "fresh", 0)).toBe(true);

    limiter.resetPair("ip-a", "u2"); // successful login for the owned account
    // IP counter survives; the IP stays blocked and only expires via the window.
    expect(limiter.isBlocked("ip-a", "fresh", 0)).toBe(true);
    expect(limiter.isBlocked("ip-a", "fresh", 60_001)).toBe(false);
  });
});
