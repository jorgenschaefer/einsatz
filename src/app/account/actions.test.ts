import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attemptLogin, authenticate, createSession } from "@/server/auth/login";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { loginRateLimiter } from "@/server/auth/rate-limit-instance";
import { findUserBySessionToken } from "@/server/auth/sessions";
import { findUserById, insertUser, type User } from "@/server/auth/users";
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
} from "@/test/bad-calls/bad-call";
import {
  PASSWORD as FIXTURE_PASSWORD,
  type Fixture,
} from "@/test/bad-calls/fixture";
import { freshDb } from "@/test/db";
import { POLICY_USERNAME, REFUSED_PASSWORDS } from "@/test/refused-passwords";
import { signIn } from "@/test/sign-in";

// The limiter is process-wide and never reset: each test uses its own address.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  forwardedFor: "",
  cookieJar: new Map<string, { value: string; options?: CookieOptions }>(),
  deletedCookies: [] as { name: string; options: CookieOptions }[],
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
    delete: (cookie: string | ({ name: string } & CookieOptions)) => {
      const { name, ...options } =
        typeof cookie === "string" ? { name: cookie } : cookie;
      state.cookieJar.delete(name);
      state.deletedCookies.push({ name, options });
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import * as actions from "./actions";

const { changePasswordAction, logoutAction, logoutOtherSessionsAction } =
  actions;

const PASSWORD = "a-good-password";
const NEW_PASSWORD = "brand-new-password";
const WRONG_CURRENT = "Das aktuelle Passwort ist nicht korrekt.";
const RATE_LIMITED =
  "Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.";
const SESSION_COOKIE = "einsatz_session";

/** Forms the action cannot read; it answers before checking any password. */
const UNREADABLE_FORMS: BadCall[] = [
  rejects("no FormData", INVALID_FORM_DATA, () =>
    changePasswordAction({}, null as Bad),
  ),
  rejects("a FormData as text", INVALID_FORM_DATA, () =>
    changePasswordAction({}, "password=neu" as Bad),
  ),
  rejects(
    "a current password as a file",
    "Das aktuelle Passwort muss Text sein.",
    () =>
      changePasswordAction(
        {},
        form({ currentPassword: aFile(), password: NEW_PASSWORD }),
      ),
  ),
  rejects("a new password as a file", "Das neue Passwort muss Text sein.", () =>
    changePasswordAction(
      {},
      form({ currentPassword: FIXTURE_PASSWORD, password: aFile() }),
    ),
  ),
];

let db: Db;
let anna: User;

const actAs: ActAs = async (caller) => {
  state.cookieJar.clear();
  if (caller === "anonymous") return;
  state.cookieJar.set(SESSION_COOKIE, { value: await signIn(db, caller) });
};

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  state.cookieJar.clear();
  state.deletedCookies = [];
  anna = await insertUser(db, {
    username: "anna",
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  });
  state.cookieJar.set(SESSION_COOKIE, {
    value: (await createSession(db, anna.id)).token,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

expectEveryActionRequiresLogin(actions, { public: ["logoutAction"], actAs });

expectBadCallsRejected(
  actions,
  {
    changePasswordAction: UNREADABLE_FORMS,
    logoutAction: "takes no input",
    logoutOtherSessionsAction: "takes no input",
  },
  { db: () => db, actAs },
);

async function changePassword(
  ip: string,
  currentPassword: string,
  newPassword = NEW_PASSWORD,
) {
  state.forwardedFor = ip;
  const result = await changePasswordAction(
    {},
    form({ currentPassword, password: newPassword }),
  );
  return result.error ?? "changed";
}

/** A failed login from `ip`, counted against the limiter `loginAction` uses. */
async function failLogin(ip: string) {
  return (
    await attemptLogin(db, loginRateLimiter, ip, "anna", "wrong-password!")
  ).status;
}

async function passwordIs(password: string) {
  return (await authenticate(db, "anna", password)) !== null;
}

describe("changePasswordAction", () => {
  it("replaces the password and keeps this browser signed in", async () => {
    expect(await changePassword("198.51.100.14", PASSWORD)).toBe("changed");

    expect(await passwordIs(NEW_PASSWORD)).toBe(true);
    expect(await passwordIs(PASSWORD)).toBe(false);
    const token = state.cookieJar.get(SESSION_COOKIE)?.value ?? "";
    expect(await findUserBySessionToken(db, token)).toMatchObject({
      id: anna.id,
    });
  });

  it.each(UNREADABLE_FORMS)("counts no attempt for $what", async ({ call }) => {
    state.forwardedFor = "198.51.100.30";
    const trackedBefore = loginRateLimiter.trackedKeyCount;

    await call(NO_FIXTURE);

    expect(loginRateLimiter.trackedKeyCount).toBe(trackedBefore);
  });
});

describe("changePasswordAction rate limit", () => {
  it("refuses the 6th check of the current password, even the right one", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await changePassword("198.51.100.10", "wrong-password!")).toBe(
        WRONG_CURRENT,
      );
    }
    expect(await changePassword("198.51.100.10", PASSWORD)).toBe(RATE_LIMITED);
    expect(await passwordIs(PASSWORD)).toBe(true);
  });

  it("does not count a successful change as a failure", async () => {
    for (let i = 0; i < 4; i++) {
      await changePassword("198.51.100.11", "wrong-password!");
    }
    expect(await changePassword("198.51.100.11", PASSWORD)).toBe("changed");
    expect(await changePassword("198.51.100.11", "wrong-password!")).toBe(
      WRONG_CURRENT,
    );
    expect(await changePassword("198.51.100.11", NEW_PASSWORD)).toBe("changed");
  });

  it("shares the counter with failed logins: the next login is refused", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await failLogin("198.51.100.12")).toBe("invalid");
    }
    for (let i = 0; i < 2; i++) {
      await changePassword("198.51.100.12", "wrong-password!");
    }
    expect(await failLogin("198.51.100.12")).toBe("rate-limited");
  });

  it("shares the counter with failed logins: the next password change is refused", async () => {
    for (let i = 0; i < 3; i++) {
      await failLogin("198.51.100.13");
    }
    for (let i = 0; i < 2; i++) {
      await changePassword("198.51.100.13", "wrong-password!");
    }
    expect(await changePassword("198.51.100.13", PASSWORD)).toBe(RATE_LIMITED);
    expect(await passwordIs(PASSWORD)).toBe(true);
  });
});

describe("changePasswordAction password policy", () => {
  it.each(REFUSED_PASSWORDS)(
    "refuses a new password $rule and keeps the old one",
    async ({ password, message }) => {
      const user = await insertUser(db, {
        username: POLICY_USERNAME,
        passwordHash: await hashPassword(PASSWORD),
        role: "user",
      });
      state.cookieJar.set(SESSION_COOKIE, {
        value: (await createSession(db, user.id)).token,
      });
      expect(await changePassword("198.51.100.20", PASSWORD, password)).toBe(
        message,
      );
      const stored = await findUserById(db, user.id);
      expect(await verifyPassword(PASSWORD, stored!.passwordHash)).toBe(true);
    },
  );
});

describe("logoutAction", () => {
  it("ends the session in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { token } = await createSession(db, anna.id);
    state.cookieJar.clear();
    state.cookieJar.set("__Host-einsatz_session", { value: token });

    await expect(logoutAction()).rejects.toMatchObject({
      redirectTo: "/login",
    });

    expect(state.cookieJar.size).toBe(0);
    expect(await findUserBySessionToken(db, token)).toBeNull();
    // Browsers ignore a __Host- cookie, even a deleting one, without Secure.
    expect(state.deletedCookies).toEqual([
      {
        name: "__Host-einsatz_session",
        options: expect.objectContaining({ secure: true, path: "/" }),
      },
    ]);
  });
});

describe("logoutOtherSessionsAction", () => {
  it("ends every other session of the user, keeping this one and other users'", async () => {
    const own = state.cookieJar.get(SESSION_COOKIE)?.value as string;
    const phone = (await createSession(db, anna.id)).token;
    const tablet = (await createSession(db, anna.id)).token;
    const bob = await insertUser(db, {
      username: "bob",
      passwordHash: "h",
      role: "user",
    });
    const bobs = (await createSession(db, bob.id)).token;

    expect(await logoutOtherSessionsAction()).toEqual({});

    expect(await findUserBySessionToken(db, phone)).toBeNull();
    expect(await findUserBySessionToken(db, tablet)).toBeNull();
    expect(await findUserBySessionToken(db, own)).toMatchObject({
      id: anna.id,
    });
    expect(await findUserBySessionToken(db, bobs)).toMatchObject({
      id: bob.id,
    });
  });
});

/** The calls in {@link UNREADABLE_FORMS} use no object of the fixture. */
const NO_FIXTURE = {} as Fixture;
