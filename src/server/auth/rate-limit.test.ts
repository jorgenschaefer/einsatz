import { describe, expect, it } from "vitest";
import { LoginRateLimiter, limiterAddress } from "./rate-limit";

function reserveTimes(
  limiter: LoginRateLimiter,
  ip: string,
  username: string,
  count: number,
  now = 0,
) {
  for (let i = 0; i < count; i++) {
    expect(limiter.tryReserve(ip, username, now)).not.toBeNull();
  }
}

describe("LoginRateLimiter – pair counter (ip:username)", () => {
  it("refuses a reservation once the pair budget is used up", () => {
    const limiter = new LoginRateLimiter(3, 100, 1000);
    reserveTimes(limiter, "ip-a", "anna", 3);
    expect(limiter.tryReserve("ip-a", "anna", 0)).toBeNull();
  });

  it("forgets reservations older than the window", () => {
    const limiter = new LoginRateLimiter(2, 100, 1000);
    reserveTimes(limiter, "ip-a", "anna", 2, 0);
    expect(limiter.tryReserve("ip-a", "anna", 999)).toBeNull();
    expect(limiter.tryReserve("ip-a", "anna", 1000)).not.toBeNull();
  });

  it("tracks (ip, username) pairs independently", () => {
    const limiter = new LoginRateLimiter(1, 100, 1000);
    reserveTimes(limiter, "ip-a", "anna", 1);
    expect(limiter.tryReserve("ip-a", "anna", 0)).toBeNull();
    expect(limiter.tryReserve("ip-a", "bob", 0)).not.toBeNull();
  });

  it("treats usernames case-insensitively", () => {
    const limiter = new LoginRateLimiter(1, 100, 1000);
    reserveTimes(limiter, "ip-a", "Anna", 1);
    expect(limiter.tryReserve("ip-a", "anna", 0)).toBeNull();
  });

  it("resetPair clears only the pair after a successful login", () => {
    const limiter = new LoginRateLimiter(1, 100, 1000);
    reserveTimes(limiter, "ip-a", "anna", 1);
    limiter.resetPair("ip-a", "anna");
    expect(limiter.tryReserve("ip-a", "anna", 0)).not.toBeNull();
  });
});

describe("LoginRateLimiter – IP counter (spraying)", () => {
  it("refuses any username once the IP budget is used up", () => {
    const limiter = new LoginRateLimiter(5, 3, 1000);
    reserveTimes(limiter, "ip-a", "u1", 1);
    reserveTimes(limiter, "ip-a", "u2", 1);
    reserveTimes(limiter, "ip-a", "u3", 1);
    expect(limiter.tryReserve("ip-a", "fresh", 0)).toBeNull();
  });

  it("does not count a refused reservation against either budget", () => {
    const limiter = new LoginRateLimiter(1, 2, 1000);
    reserveTimes(limiter, "ip-a", "anna", 1);
    for (let i = 0; i < 10; i++) limiter.tryReserve("ip-a", "anna", 0);
    expect(limiter.tryReserve("ip-a", "bob", 0)).not.toBeNull();
  });

  it("keeps IPs isolated: exhausting IP A does not block IP B", () => {
    const limiter = new LoginRateLimiter(5, 3, 1000);
    reserveTimes(limiter, "ip-a", "u1", 3);
    expect(limiter.tryReserve("ip-a", "u4", 0)).toBeNull();
    expect(limiter.tryReserve("ip-b", "u1", 0)).not.toBeNull();
  });

  it("forgets IP reservations older than the window", () => {
    const limiter = new LoginRateLimiter(5, 2, 1000);
    reserveTimes(limiter, "ip-a", "u1", 1, 0);
    reserveTimes(limiter, "ip-a", "u2", 1, 100);
    expect(limiter.tryReserve("ip-a", "u3", 200)).toBeNull();
    expect(limiter.tryReserve("ip-a", "u3", 1200)).not.toBeNull();
  });

  it("resetPair does NOT clear the IP counter (a valid account cannot drain the IP budget)", () => {
    const limiter = new LoginRateLimiter(5, 2, 60_000);
    reserveTimes(limiter, "ip-a", "u1", 1);
    reserveTimes(limiter, "ip-a", "u2", 1);
    limiter.resetPair("ip-a", "u2");
    expect(limiter.tryReserve("ip-a", "fresh", 0)).toBeNull();
    expect(limiter.tryReserve("ip-a", "fresh", 60_001)).not.toBeNull();
  });
});

describe("LoginRateLimiter – release", () => {
  it("gives a released reservation back to both budgets", () => {
    const limiter = new LoginRateLimiter(1, 1, 1000);
    limiter.tryReserve("ip-a", "anna", 0)?.release();
    expect(limiter.tryReserve("ip-a", "anna", 0)).not.toBeNull();
  });

  it("releases only its own reservation", () => {
    const limiter = new LoginRateLimiter(2, 20, 1000);
    const first = limiter.tryReserve("ip-a", "anna", 0);
    reserveTimes(limiter, "ip-a", "anna", 1);
    first?.release();
    first?.release();
    reserveTimes(limiter, "ip-a", "anna", 1);
    expect(limiter.tryReserve("ip-a", "anna", 0)).toBeNull();
  });
});

describe("LoginRateLimiter – attempt", () => {
  it("refuses without running the check once a budget is used up", async () => {
    const limiter = new LoginRateLimiter(1, 20, 60_000);
    reserveTimes(limiter, "ip-a", "anna", 1, Date.now());
    let checked = false;
    const result = await limiter.attempt("ip-a", "anna", async () => {
      checked = true;
      return true;
    });
    expect(result).toEqual({ status: "rate-limited" });
    expect(checked).toBe(false);
  });

  it("keeps a failed check as a failure", async () => {
    const limiter = new LoginRateLimiter(1, 20, 60_000);
    expect(await limiter.attempt("ip-a", "anna", async () => false)).toEqual({
      status: "checked",
      result: false,
    });
    expect(await limiter.attempt("ip-a", "anna", async () => true)).toEqual({
      status: "rate-limited",
    });
  });

  it("gives a successful check back and resets the pair", async () => {
    const limiter = new LoginRateLimiter(2, 3, 60_000);
    await limiter.attempt("ip-a", "anna", async () => null);
    expect(await limiter.attempt("ip-a", "anna", async () => "anna")).toEqual({
      status: "checked",
      result: "anna",
    });
    await limiter.attempt("ip-a", "anna", async () => null);
    // Pair 1 of 2 and IP 2 of 3: only true if the success counted for neither.
    expect(limiter.tryReserve("ip-a", "anna")).not.toBeNull();
  });

  it("gives a check that throws back and passes the error on", async () => {
    const limiter = new LoginRateLimiter(1, 1, 60_000);
    await expect(
      limiter.attempt("ip-a", "anna", async () => {
        throw new Error("database down");
      }),
    ).rejects.toThrow("database down");
    expect(limiter.tryReserve("ip-a", "anna")).not.toBeNull();
  });
});

describe("LoginRateLimiter – IPv6 /64 and IPv4-mapped addresses", () => {
  it("shares the counters of one IPv6 /64", () => {
    const limiter = new LoginRateLimiter(2, 20, 1000);
    reserveTimes(limiter, "2001:db8:1:2::a", "anna", 1);
    reserveTimes(limiter, "2001:db8:1:2:ffff::b", "anna", 1);
    expect(limiter.tryReserve("2001:db8:1:2::c", "anna", 0)).toBeNull();
    expect(limiter.tryReserve("2001:db8:1:3::a", "anna", 0)).not.toBeNull();
  });

  it("resets the pair for every address of the /64", () => {
    const limiter = new LoginRateLimiter(1, 20, 1000);
    reserveTimes(limiter, "2001:db8:1:2::a", "anna", 1);
    limiter.resetPair("2001:db8:1:2::b", "anna");
    expect(limiter.tryReserve("2001:db8:1:2::a", "anna", 0)).not.toBeNull();
  });
});

describe("limiterAddress", () => {
  it.each([
    ["2001:0db8:0001:0002:0003:0004:0005:0006", "2001:db8:1:2::/64"],
    ["2001:db8:1:2::a", "2001:db8:1:2::/64"],
    ["2001:db8:1:2:ffff::b", "2001:db8:1:2::/64"],
    ["2001:DB8:1:2::A", "2001:db8:1:2::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["2001:db8:1:3::a", "2001:db8:1:3::/64"],
    ["::1", "0:0:0:0::/64"],
    ["::", "0:0:0:0::/64"],
    ["fe80::", "fe80:0:0:0::/64"],
    ["::ffff:203.0.113.7", "203.0.113.7"],
    ["::FFFF:cb00:7107", "203.0.113.7"],
    ["203.0.113.7", "203.0.113.7"],
    ["local", "local"],
    ["", ""],
    ["2001:db8::1::2", "2001:db8::1::2"],
    ["2001:db8:1:2:3:4:5:6:7", "2001:db8:1:2:3:4:5:6:7"],
    ["2001:db8:1:2:3:4:5", "2001:db8:1:2:3:4:5"],
    ["2001:db8:12345::1", "2001:db8:12345::1"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
  ])("%s → %s", (ip, expected) => {
    expect(limiterAddress(ip)).toBe(expected);
  });
});

describe("LoginRateLimiter – memory eviction", () => {
  it("keeps a key of fixed size however long the username", () => {
    const limiter = new LoginRateLimiter(5, 20, 1000);
    reserveTimes(limiter, "ip-a", "x".repeat(1024 * 1024), 1);
    expect(limiter.trackedKeyChars).toBeLessThan(200);
  });

  it("does not seed buckets for refused reservations", () => {
    const limiter = new LoginRateLimiter(1, 20, 1000);
    reserveTimes(limiter, "ip-a", "anna", 1);
    for (let i = 0; i < 10; i++) limiter.tryReserve("ip-a", "anna", 0);
    expect(limiter.trackedKeyCount).toBe(2);
  });

  it("drops the buckets a release empties", () => {
    const limiter = new LoginRateLimiter(5, 20, 1000);
    for (let i = 0; i < 50; i++) {
      limiter.tryReserve(`ip-${i}`, "u", 0)?.release();
    }
    expect(limiter.trackedKeyCount).toBe(0);
  });

  it("evicts fully-stale buckets so the map cannot grow unbounded", () => {
    const limiter = new LoginRateLimiter(5, 20, 1000);
    for (let i = 0; i < 50; i++) reserveTimes(limiter, `ip-${i}`, "u", 1);
    expect(limiter.trackedKeyCount).toBe(100);
    reserveTimes(limiter, "ip-new", "u", 1, 5000);
    expect(limiter.trackedKeyCount).toBe(2);
  });

  it("keeps in-window buckets when it sweeps (a live block survives)", () => {
    const limiter = new LoginRateLimiter(2, 20, 1000);
    reserveTimes(limiter, "stale", "x", 1, 0);
    reserveTimes(limiter, "ip-a", "anna", 1, 800);
    reserveTimes(limiter, "ip-a", "anna", 1, 900);
    reserveTimes(limiter, "ip-b", "z", 1, 1001);
    expect(limiter.tryReserve("ip-a", "anna", 1001)).toBeNull();
  });
});
