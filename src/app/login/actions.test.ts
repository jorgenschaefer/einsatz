import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/server/auth/password";
import { insertUser } from "@/server/auth/users";
import { freshDb } from "@/test/db";

// The limiter is process-wide and never reset: each test uses its own address.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  forwardedFor: "",
}));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.forwardedFor }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import { loginAction } from "./actions";

const PASSWORD = "a-good-password";
const INVALID =
  "Anmeldung fehlgeschlagen. Bitte Nutzername und Passwort prüfen.";
const RATE_LIMITED =
  "Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.";

beforeEach(async () => {
  state.db = await freshDb();
  await insertUser(state.db as Awaited<ReturnType<typeof freshDb>>, {
    username: "anna",
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function login(ip: string, username: string, password: string) {
  state.forwardedFor = ip;
  const form = new FormData();
  form.set("username", username);
  form.set("password", password);
  try {
    return (await loginAction({}, form)).error;
  } catch (error) {
    if ((error as { redirectTo?: string }).redirectTo) return "redirected";
    throw error;
  }
}

async function failTimes(ip: string, count: number, username = "anna") {
  for (let i = 0; i < count; i++) {
    expect(await login(ip, username, "wrong-password!")).toBe(INVALID);
  }
}

function countOf(results: (string | undefined)[], value: string) {
  return results.filter((result) => result === value).length;
}

describe("loginAction rate limit", () => {
  it("checks at most 5 concurrent wrong passwords for one username", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        login("198.51.100.1", "anna", "wrong-password!"),
      ),
    );
    expect(countOf(results, INVALID)).toBe(5);
    expect(countOf(results, RATE_LIMITED)).toBe(25);
  });

  it("checks at most 20 concurrent attempts from one IP across usernames", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        login("198.51.100.2", `user-${i}`, "wrong-password!"),
      ),
    );
    expect(countOf(results, INVALID)).toBe(20);
    expect(countOf(results, RATE_LIMITED)).toBe(10);
  });

  it("refuses even the correct password after 5 failures", async () => {
    await failTimes("198.51.100.3", 5);
    expect(await login("198.51.100.3", "anna", PASSWORD)).toBe(RATE_LIMITED);
  });

  it("counts all addresses of an IPv6 /64 together", async () => {
    const sameSlash64 = [
      "2001:db8:1:2::a",
      "2001:db8:1:2:ffff::b",
      "2001:0db8:0001:0002:0000:0000:0000:000c",
      "2001:DB8:1:2:1:2:3:4",
      "2001:db8:1:2::",
    ];
    for (const ip of sameSlash64) {
      expect(await login(ip, "anna", "wrong-password!")).toBe(INVALID);
    }
    expect(await login("2001:db8:1:2::f", "anna", "wrong-password!")).toBe(
      RATE_LIMITED,
    );
    expect(await login("2001:db8:1:3::a", "anna", "wrong-password!")).toBe(
      INVALID,
    );
  });

  it("counts an IPv4-mapped address as its IPv4 address", async () => {
    await failTimes("::ffff:203.0.113.7", 5);
    expect(await login("203.0.113.7", "anna", "wrong-password!")).toBe(
      RATE_LIMITED,
    );
  });

  it("checks again once the 5-minute window has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
    await failTimes("198.51.100.4", 5);
    vi.setSystemTime(new Date("2026-10-03T10:04:59Z"));
    expect(await login("198.51.100.4", "anna", PASSWORD)).toBe(RATE_LIMITED);
    vi.setSystemTime(new Date("2026-10-03T10:05:01Z"));
    expect(await login("198.51.100.4", "anna", PASSWORD)).toBe("redirected");
  });
});
