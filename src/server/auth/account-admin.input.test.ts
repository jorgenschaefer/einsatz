import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/db";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createAccount,
  deleteAccount,
  resetPassword,
  setRole,
} from "./account-admin";
import { hashPassword } from "./password";
import { insertUser, listUsers } from "./users";

// Die Nutzerverwaltung nimmt, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

const PASSWORD = "a-good-password";

async function withAnna() {
  const db = await freshDb();
  const anna = await insertUser(db, {
    username: "anna",
    passwordHash: await hashPassword(PASSWORD),
    role: "admin",
  });
  return { db, annaId: anna.id };
}

describe("account administration input", () => {
  it.each([
    ["a number as Nutzername", 7, PASSWORD, "Der Nutzername muss Text sein."],
    [
      "a Nutzername of 201 characters",
      "x".repeat(201),
      PASSWORD,
      "Der Nutzername darf höchstens 200 Zeichen lang sein.",
    ],
    [
      "a Nutzername of 201 characters once trimmed",
      ` ${"x".repeat(201)} `,
      PASSWORD,
      "Der Nutzername darf höchstens 200 Zeichen lang sein.",
    ],
    ["a number as password", "bert", 7, "Das Passwort muss Text sein."],
  ])(
    "refuses a new account with %s",
    async (_, username, password, message) => {
      const { db } = await withAnna();

      await expect(
        createAccount(db, {
          username: username as Bad,
          password: password as Bad,
          role: "user",
        }),
      ).rejects.toThrow(new ValidationError(message));

      expect(await listUsers(db)).toHaveLength(1);
    },
  );

  it("refuses a role other than admin and user", async () => {
    const { db, annaId } = await withAnna();

    await expect(setRole(db, annaId, "superadmin" as Bad)).rejects.toThrow(
      new ValidationError("Unbekannte Rolle."),
    );
  });

  it.each([
    ["setting a role", (db: Db) => setRole(db, "user-1", "admin")],
    ["resetting a password", (db: Db) => resetPassword(db, "user-1", PASSWORD)],
    ["deleting an account", (db: Db) => deleteAccount(db, "user-1")],
  ])("refuses %s for a Nutzer-ID that is not a UUID", async (_, call) => {
    const { db } = await withAnna();

    await expect(call(db)).rejects.toThrow(
      new ValidationError("Ungültige ID."),
    );
  });

  it("refuses a number as new password", async () => {
    const { db, annaId } = await withAnna();

    await expect(resetPassword(db, annaId, 7 as Bad)).rejects.toThrow(
      new ValidationError("Das Passwort muss Text sein."),
    );
  });
});
