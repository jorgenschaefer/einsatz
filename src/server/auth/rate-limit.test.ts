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

describe("LoginRateLimiter – memory eviction", () => {
  it("does not seed buckets while merely checking isBlocked (failure-free load)", () => {
    const limiter = new LoginRateLimiter(5, 20, 1000);
    // Ein fehlerfreier Ansturm: viele distinct IPs prüfen nur ihren Status, ohne
    // je einen Fehlversuch zu erzeugen. isBlocked darf dabei keine Buckets anlegen,
    // sonst wächst die Map unbegrenzt (der Sweep läuft nur in recordFailure).
    for (let i = 0; i < 50; i++) limiter.isBlocked(`ip-${i}`, "u", 0);
    expect(limiter.trackedKeyCount).toBe(0);
  });

  it("neither resurrects nor grows a stale key when only isBlocked touches it", () => {
    const limiter = new LoginRateLimiter(1, 20, 1000);
    limiter.recordFailure("ip-a", "anna", 0); // legt pair+ip-Bucket bei t=0 an
    expect(limiter.isBlocked("ip-a", "anna", 0)).toBe(true);
    expect(limiter.trackedKeyCount).toBe(2);
    // Nach dem Fenster: reine isBlocked-Prüfungen beleben den Block nicht wieder
    // und legen keine weiteren Buckets an.
    for (let i = 0; i < 10; i++) limiter.isBlocked("ip-a", "anna", 5000);
    expect(limiter.isBlocked("ip-a", "anna", 5000)).toBe(false);
    expect(limiter.trackedKeyCount).toBe(2);
  });

  it("evicts fully-stale buckets so the map cannot grow unbounded", () => {
    const limiter = new LoginRateLimiter(5, 20, 1000);
    // 50 distinct IPs each fail once at t=0 → 50 IP buckets + 50 pair buckets.
    for (let i = 0; i < 50; i++) limiter.recordFailure(`ip-${i}`, "u", 0);
    expect(limiter.trackedKeyCount).toBeGreaterThanOrEqual(100);

    // A single failure past the window sweeps the now-stale t=0 buckets, leaving
    // only the fresh IP's own pair+IP buckets.
    limiter.recordFailure("ip-new", "u", 5000);
    expect(limiter.trackedKeyCount).toBe(2);
  });

  it("keeps in-window buckets when it sweeps (a live block survives)", () => {
    const limiter = new LoginRateLimiter(2, 20, 1000);
    limiter.recordFailure("stale", "x", 0); // first call sets the sweep clock (t=0)
    limiter.recordFailure("ip-a", "anna", 800); // in-window failure #1
    limiter.recordFailure("ip-a", "anna", 900); // in-window failure #2 → at budget
    // A failure past the window triggers a sweep (cutoff t=1): 'stale' (t=0) is
    // dropped, but ip-a's t=800/900 failures survive and keep the block.
    limiter.recordFailure("ip-b", "z", 1001);
    expect(limiter.isBlocked("ip-a", "anna", 1001)).toBe(true);
  });
});
