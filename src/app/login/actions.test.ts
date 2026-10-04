import { beforeEach, describe, expect, it, vi } from "vitest";
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
});

/** The calls in {@link UNREADABLE_FORMS} use no object of the fixture. */
const NO_FIXTURE = {} as Fixture;
