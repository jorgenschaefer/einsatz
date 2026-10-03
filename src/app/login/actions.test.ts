import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/server/auth/current-user";
import { hashPassword } from "@/server/auth/password";
import { loginRateLimiter } from "@/server/auth/rate-limit-instance";
import { findUserBySessionToken, insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import type { Db } from "@/server/db/db";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
} from "@/test/action-checks";
import {
  aFile,
  type Bad,
  type BadCall,
  form,
  INVALID_FORM_DATA,
  rejects,
  text,
} from "@/test/bad-calls/bad-call";
import {
  PASSWORD as FIXTURE_PASSWORD,
  type Fixture,
} from "@/test/bad-calls/fixture";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";

// The limiter is process-wide and never reset: each test uses its own address.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  forwardedFor: "",
  cookieJar: new Map<string, { value: string; options?: CookieOptions }>(),
}));

type CookieOptions = Record<string, unknown>;

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.forwardedFor }),
  cookies: async () => ({
    get: (name: string) => state.cookieJar.get(name),
    set: (name: string, value: string, options?: CookieOptions) => {
      state.cookieJar.set(name, { value, options });
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import * as actions from "./actions";

const { loginAction } = actions;

const PASSWORD = "a-good-password";
const INVALID =
  "Anmeldung fehlgeschlagen. Bitte Nutzername und Passwort prüfen.";
const RATE_LIMITED =
  "Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.";

/** Forms the action cannot read; it answers before counting an attempt. */
const UNREADABLE_FORMS: BadCall[] = [
  rejects("no FormData", INVALID_FORM_DATA, () =>
    loginAction({}, "username=a" as Bad),
  ),
  rejects("a Nutzername as a file", "Der Nutzername muss Text sein.", () =>
    loginAction({}, form({ username: aFile(), password: FIXTURE_PASSWORD })),
  ),
  rejects("a password as a file", "Das Passwort muss Text sein.", () =>
    loginAction({}, form({ username: "anna", password: aFile() })),
  ),
];

let annaId: string;

const actAs: ActAs = async (caller) => {
  state.cookieJar.clear();
  if (caller === "anonymous") return;
  state.cookieJar.set("einsatz_session", {
    value: await signIn(state.db as Db, caller),
  });
};

beforeEach(async () => {
  state.db = await freshDb();
  state.cookieJar.clear();
  ({ id: annaId } = await insertUser(state.db as Db, {
    username: "anna",
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

expectEveryActionRequiresLogin(actions, { public: ["loginAction"], actAs });

expectBadCallsRejected(
  actions,
  {
    loginAction: [
      ...UNREADABLE_FORMS,
      rejects("a Nutzername longer than any account's", INVALID, () =>
        loginAction(
          {},
          form({ username: text(201), password: FIXTURE_PASSWORD }),
        ),
      ),
    ],
  },
  { db: () => state.db as Db, actAs },
);

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

describe("loginAction input", () => {
  it.each(UNREADABLE_FORMS)(
    "counts no attempt and creates no session for $what",
    async ({ call }) => {
      state.forwardedFor = "198.51.100.30";
      const trackedBefore = loginRateLimiter.trackedKeyCount;

      await call(NO_FIXTURE);

      expect(loginRateLimiter.trackedKeyCount).toBe(trackedBefore);
      const { rows } = await (state.db as Db).query("SELECT 1 FROM sessions");
      expect(rows).toHaveLength(0);
    },
  );
});

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

describe("loginAction session", () => {
  const db = () => state.db as Db;
  const sessionCookie = () => state.cookieJar.get("einsatz_session")?.value;

  it("ends this browser's previous session on a new login, not another browser's", async () => {
    await insertSession(db(), {
      token: "other-browser",
      userId: annaId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await login("198.51.100.10", "anna", PASSWORD)).toBe("redirected");
    const first = sessionCookie();

    expect(await login("198.51.100.10", "anna", PASSWORD)).toBe("redirected");
    const second = sessionCookie();

    expect(first).toBeDefined();
    expect(second).not.toBe(first);
    expect(await findUserBySessionToken(db(), first ?? "")).toBeNull();
    expect(await findUserBySessionToken(db(), second ?? "")).not.toBeNull();
    expect(await findUserBySessionToken(db(), "other-browser")).not.toBeNull();
  });

  it("keeps this browser's session when a new login fails", async () => {
    expect(await login("198.51.100.11", "anna", PASSWORD)).toBe("redirected");
    const token = sessionCookie() ?? "";

    expect(await login("198.51.100.11", "anna", "wrong-password!")).toBe(
      INVALID,
    );

    expect(await findUserBySessionToken(db(), token)).not.toBeNull();
  });

  it("stores nothing from which a valid session can be taken", async () => {
    expect(await login("198.51.100.12", "anna", PASSWORD)).toBe("redirected");
    const token = sessionCookie();
    expect(await getCurrentUser()).not.toBeNull();

    const { rows } = await db().query<{ row: Record<string, unknown> }>(
      "SELECT row_to_json(s) AS row FROM sessions s",
    );
    const stored = rows.flatMap(({ row }) => Object.values(row).map(String));
    expect(stored.length).toBeGreaterThan(0);
    expect(stored).not.toContain(token);
    for (const value of stored) {
      state.cookieJar.set("einsatz_session", { value });
      expect(await getCurrentUser()).toBeNull();
    }
  });

  it("names the cookie __Host-einsatz_session in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(await login("198.51.100.13", "anna", PASSWORD)).toBe("redirected");

    expect([...state.cookieJar.keys()]).toEqual(["__Host-einsatz_session"]);
    const { options } = state.cookieJar.get("__Host-einsatz_session") ?? {};
    expect(options).toMatchObject({ secure: true, path: "/" });
    expect(options).not.toHaveProperty("domain");
    expect(await getCurrentUser()).toMatchObject({ username: "anna" });
  });

  it("keeps the name einsatz_session, without Secure, outside production", async () => {
    expect(await login("198.51.100.14", "anna", PASSWORD)).toBe("redirected");

    expect([...state.cookieJar.keys()]).toEqual(["einsatz_session"]);
    expect(state.cookieJar.get("einsatz_session")?.options).toMatchObject({
      secure: false,
      path: "/",
    });
  });
});

/** The calls in {@link UNREADABLE_FORMS} use no object of the fixture. */
const NO_FIXTURE = {} as Fixture;
