import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/login";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { findUserById, insertUser, type User } from "@/server/auth/users";
import type { Db } from "@/server/db/db";
import { freshDb } from "@/test/db";

// The limiter is process-wide and never reset: each test uses its own address.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  forwardedFor: "",
}));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.forwardedFor }),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: (_name: string, value: string) => {
      state.token = value;
    },
    delete: () => {
      state.token = undefined;
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import { loginAction } from "@/app/login/actions";
import { changePasswordAction } from "./actions";

const PASSWORD = "a-good-password";
const NEW_PASSWORD = "brand-new-password";
const WRONG_CURRENT = "Das aktuelle Passwort ist nicht korrekt.";
const LOGIN_INVALID =
  "Anmeldung fehlgeschlagen. Bitte Nutzername und Passwort prüfen.";
const RATE_LIMITED =
  "Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.";

let db: Db;
let anna: User;

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  anna = await insertUser(db, {
    username: "anna",
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  });
  state.token = (await createSession(db, anna.id)).token;
});

async function changePassword(ip: string, currentPassword: string) {
  state.forwardedFor = ip;
  const form = new FormData();
  form.set("currentPassword", currentPassword);
  form.set("password", NEW_PASSWORD);
  const result = await changePasswordAction({}, form);
  return result.error ?? "changed";
}

async function login(ip: string, password: string) {
  state.forwardedFor = ip;
  const form = new FormData();
  form.set("username", "anna");
  form.set("password", password);
  const token = state.token;
  try {
    return (await loginAction({}, form)).error;
  } catch (error) {
    if (!(error as { redirectTo?: string }).redirectTo) throw error;
    return "logged in";
  } finally {
    state.token = token;
  }
}

async function storedPasswordIs(password: string) {
  const user = await findUserById(db, anna.id);
  return verifyPassword(password, user?.passwordHash ?? "");
}

describe("changePasswordAction rate limit", () => {
  it("refuses the 6th check of the current password, even the right one", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await changePassword("198.51.100.10", "wrong-password!")).toBe(
        WRONG_CURRENT,
      );
    }
    expect(await changePassword("198.51.100.10", PASSWORD)).toBe(RATE_LIMITED);
    expect(await storedPasswordIs(PASSWORD)).toBe(true);
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
      expect(await login("198.51.100.12", "wrong-password!")).toBe(
        LOGIN_INVALID,
      );
    }
    for (let i = 0; i < 2; i++) {
      await changePassword("198.51.100.12", "wrong-password!");
    }
    expect(await login("198.51.100.12", PASSWORD)).toBe(RATE_LIMITED);
  });

  it("shares the counter with failed logins: the next password change is refused", async () => {
    for (let i = 0; i < 3; i++) {
      await login("198.51.100.13", "wrong-password!");
    }
    for (let i = 0; i < 2; i++) {
      await changePassword("198.51.100.13", "wrong-password!");
    }
    expect(await changePassword("198.51.100.13", PASSWORD)).toBe(RATE_LIMITED);
    expect(await storedPasswordIs(PASSWORD)).toBe(true);
  });
});
