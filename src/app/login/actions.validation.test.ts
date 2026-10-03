import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

import { loginRateLimiter } from "@/server/auth/rate-limit-instance";
import { freshDb } from "@/test/db";
import { loginAction } from "./actions";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

beforeEach(async () => {
  state.db = await freshDb();
});

describe("loginAction without a FormData", () => {
  it("is rejected with a message, without counting an attempt or creating a session", async () => {
    const trackedBefore = loginRateLimiter.trackedKeyCount;

    expect(await loginAction({}, "username=anna" as Bad)).toEqual({
      error: "Ungültige Formulardaten.",
    });

    expect(loginRateLimiter.trackedKeyCount).toBe(trackedBefore);
    const { rows } = await (state.db as Db).query("SELECT 1 FROM sessions");
    expect(rows).toHaveLength(0);
  });
});

describe.each([
  ["username", "Der Nutzername muss Text sein."],
  ["password", "Das Passwort muss Text sein."],
])("loginAction with a file as %s", (field, error) => {
  it("is rejected with a message, without counting an attempt or creating a session", async () => {
    const trackedBefore = loginRateLimiter.trackedKeyCount;
    const form = new FormData();
    form.set("username", "anna");
    form.set("password", "a-very-good-password");
    form.set(field, new File(["anna"], "field.txt"));

    expect(await loginAction({}, form)).toEqual({ error });

    expect(loginRateLimiter.trackedKeyCount).toBe(trackedBefore);
    const { rows } = await (state.db as Db).query("SELECT 1 FROM sessions");
    expect(rows).toHaveLength(0);
  });
});
