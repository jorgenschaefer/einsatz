import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
  }),
}));

import { loginRateLimiter } from "@/server/auth/rate-limit-instance";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import { changePasswordAction } from "./actions";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(state.db as Db);
});

/** Alle Passwort-Hashes und Sitzungen. */
async function passwordsAndSessions() {
  const db = state.db as Db;
  const users = await db.query("SELECT id, password_hash FROM users");
  const sessions = await db.query(
    "SELECT token_hash, user_id, expires_at FROM sessions",
  );
  return { users: users.rows, sessions: sessions.rows };
}

describe("changePasswordAction without a FormData", () => {
  it("is rejected with a message, without counting an attempt or changing anything", async () => {
    const before = await passwordsAndSessions();
    const trackedBefore = loginRateLimiter.trackedKeyCount;

    expect(await changePasswordAction({}, "password=neu" as Bad)).toEqual({
      error: "Ungültige Formulardaten.",
    });

    expect(loginRateLimiter.trackedKeyCount).toBe(trackedBefore);
    expect(await passwordsAndSessions()).toEqual(before);
  });
});

describe.each([
  ["currentPassword", "Das aktuelle Passwort muss Text sein."],
  ["password", "Das neue Passwort muss Text sein."],
])("changePasswordAction with a file as %s", (field, error) => {
  it("is rejected with a message, without counting an attempt or changing anything", async () => {
    const before = await passwordsAndSessions();
    const trackedBefore = loginRateLimiter.trackedKeyCount;
    const form = new FormData();
    form.set("currentPassword", "a-very-good-password");
    form.set("password", "another-good-password");
    form.set(field, new File(["another-good-password"], "password.txt"));

    expect(await changePasswordAction({}, form)).toEqual({ error });

    expect(loginRateLimiter.trackedKeyCount).toBe(trackedBefore);
    expect(await passwordsAndSessions()).toEqual(before);
  });
});

describe("changePasswordAction without a FormData and without a session", () => {
  it("sends the caller to the login before looking at the input", async () => {
    state.token = undefined;

    await expect(
      changePasswordAction({}, "password=neu" as Bad),
    ).rejects.toMatchObject({ redirectTo: "/login" });
  });
});
