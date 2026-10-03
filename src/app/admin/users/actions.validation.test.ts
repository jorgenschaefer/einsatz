import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
  }),
}));

import { hashPassword } from "@/server/auth/password";
import { findUserByUsername, insertUser } from "@/server/auth/users";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import {
  createAccountAction,
  deleteAccountAction,
  resetPasswordAction,
  setRoleAction,
} from "./actions";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

const PASSWORD = "a-good-password";
const INVALID_ID = "Ungültige ID.";
const NOT_A_UUID = "user-1";
const longText = (length: number) => "x".repeat(length);

const badCalls: [string, string, (anna: string) => Promise<ActionResult>][] = [
  [
    "a new account with a number as Nutzername",
    "Der Nutzername muss Text sein.",
    () => createAccountAction(7 as Bad, PASSWORD, false),
  ],
  [
    "a new account with a Nutzername of 201 characters",
    "Der Nutzername darf höchstens 200 Zeichen lang sein.",
    () => createAccountAction(longText(201), PASSWORD, false),
  ],
  [
    "a new account with a number as password",
    "Das Passwort muss Text sein.",
    () => createAccountAction("bert", 7 as Bad, false),
  ],
  [
    "a new account with an Administrator flag that is not a boolean",
    "„Administrator“ muss wahr oder falsch sein.",
    () => createAccountAction("bert", PASSWORD, "yes" as Bad),
  ],
  [
    "a role that is neither admin nor user",
    "Unbekannte Rolle.",
    (anna) => setRoleAction(anna, "superadmin" as Bad),
  ],
  [
    "a role for a Nutzer-ID that is not a UUID",
    INVALID_ID,
    () => setRoleAction(NOT_A_UUID, "admin"),
  ],
  [
    "a password reset for a Nutzer-ID that is not a UUID",
    INVALID_ID,
    () => resetPasswordAction(NOT_A_UUID, PASSWORD),
  ],
  [
    "a password reset with a number as password",
    "Das Passwort muss Text sein.",
    (anna) => resetPasswordAction(anna, 7 as Bad),
  ],
  [
    "deleting a Nutzer-ID that is not a UUID",
    INVALID_ID,
    () => deleteAccountAction(NOT_A_UUID),
  ],
];

let db: Db;
let annaId: string;

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  state.token = await signIn(db, "admin");
  ({ id: annaId } = await insertUser(db, {
    username: "anna",
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  }));
  await signIn(db);
});

/** Alle Konten samt Passwort-Hash und alle Sitzungen. */
async function accountsAndSessions() {
  const users = await db.query(
    "SELECT id, username, password_hash, role FROM users ORDER BY id",
  );
  const sessions = await db.query(
    "SELECT token_hash, user_id, expires_at FROM sessions ORDER BY token_hash",
  );
  return { users: users.rows, sessions: sessions.rows };
}

describe.each(badCalls)("%s", (_, error, call) => {
  it("is rejected with a message and stores nothing", async () => {
    const before = await accountsAndSessions();

    expect(await call(annaId)).toEqual({ error });

    expect(await accountsAndSessions()).toEqual(before);
  });
});

describe("a new account with the longest Nutzername allowed", () => {
  it("stores a Nutzername of 200 characters, trimmed", async () => {
    const username = longText(200);

    expect(await createAccountAction(` ${username} `, PASSWORD, false)).toEqual(
      {},
    );

    expect(await findUserByUsername(db, username)).toMatchObject({
      username,
      role: "user",
    });
  });
});
