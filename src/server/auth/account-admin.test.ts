import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { Db } from "@/server/db/db";
import { appendEntry, listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import { POLICY_USERNAME, REFUSED_PASSWORDS } from "@/test/refused-passwords";
import {
  changePassword,
  createAccount,
  deleteAccount,
  resetPassword,
  setRole,
} from "./account-admin";
import { hashPassword, verifyPassword } from "./password";
import { LoginRateLimiter, RATE_LIMITED_MESSAGE } from "./rate-limit";
import { findUserBySessionToken, insertSession } from "./sessions";
import {
  countAdmins,
  findUserById,
  findUserByUsername,
  insertUser,
  listUsers,
} from "./users";

// Die Nutzerverwaltung nimmt, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

const inAnHour = () => new Date(Date.now() + 60 * 60_000);

const TAKEN = "Dieser Nutzername ist bereits vergeben.";
const WRONG_CURRENT = "Das aktuelle Passwort ist nicht korrekt.";

async function seedAdmin(
  db: Awaited<ReturnType<typeof freshDb>>,
  username = "chef",
) {
  return insertUser(db, {
    username,
    passwordHash: await hashPassword("admin-secret-1"),
    role: "admin",
  });
}

describe("createAccount", () => {
  it("creates a user with a hashed password and role", async () => {
    const db = await freshDb();
    const created = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    expect(created.role).toBe("user");
    const found = await findUserByUsername(db, "anna");
    expect(await verifyPassword("a-good-password", found!.passwordHash)).toBe(
      true,
    );
  });

  it("stores a Nutzername of 200 characters, trimmed", async () => {
    const db = await freshDb();
    const username = "x".repeat(200);

    await createAccount(db, {
      username: ` ${username} `,
      password: "a-good-password",
      role: "user",
    });

    expect(await findUserByUsername(db, username)).toMatchObject({ username });
  });

  it("refuses a username that differs from an existing one only in case", async () => {
    const db = await freshDb();
    await seedAdmin(db, "anna");

    await expect(
      createAccount(db, {
        username: "Anna",
        password: "a-good-password",
        role: "user",
      }),
    ).rejects.toThrow(new ValidationError(TAKEN));
    expect((await listUsers(db)).map((u) => u.username)).toEqual(["anna"]);
  });

  it("creates exactly one account for two concurrent requests differing in case", async () => {
    const db = await freshDb();
    const create = (username: string) =>
      createAccount(db, {
        username,
        password: "a-good-password",
        role: "user",
      });

    const results = await Promise.allSettled([create("bob"), create("Bob")]);

    expect(results.filter((r) => r.status === "rejected")).toEqual([
      { status: "rejected", reason: new ValidationError(TAKEN) },
    ]);
    const bobs = (await listUsers(db)).filter(
      (u) => u.username.toLowerCase() === "bob",
    );
    expect(bobs).toHaveLength(1);
  });

  it.each(REFUSED_PASSWORDS)(
    "refuses a password $rule and creates nothing",
    async ({ password, message }) => {
      const db = await freshDb();

      await expect(
        createAccount(db, {
          username: POLICY_USERNAME,
          password,
          role: "user",
        }),
      ).rejects.toThrow(new ValidationError(message));
      expect(await findUserByUsername(db, POLICY_USERNAME)).toBeNull();
    },
  );

  it("rejects a too-short password and creates nothing", async () => {
    const db = await freshDb();
    await expect(
      createAccount(db, { username: "anna", password: "short", role: "user" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await findUserByUsername(db, "anna")).toBeNull();
  });

  it.each([
    [
      "a number as Nutzername",
      7,
      "a-good-password",
      "Der Nutzername muss Text sein.",
    ],
    [
      "a Nutzername of 201 characters",
      "x".repeat(201),
      "a-good-password",
      "Der Nutzername darf höchstens 200 Zeichen lang sein.",
    ],
    [
      "a Nutzername of 201 characters once trimmed",
      ` ${"x".repeat(201)} `,
      "a-good-password",
      "Der Nutzername darf höchstens 200 Zeichen lang sein.",
    ],
    ["a number as password", "bert", 7, "Das Passwort muss Text sein."],
  ])(
    "refuses a new account with %s",
    async (_, username, password, message) => {
      const db = await freshDb();
      await seedAdmin(db);

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
});

describe("setRole (last-admin protection)", () => {
  it("promotes a user to admin", async () => {
    const db = await freshDb();
    await seedAdmin(db);
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await setRole(db, anna.id, "admin");
    expect((await findUserById(db, anna.id))?.role).toBe("admin");
  });

  it("blocks demoting the last remaining admin", async () => {
    const db = await freshDb();
    const chef = await seedAdmin(db);
    await expect(setRole(db, chef.id, "user")).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await findUserById(db, chef.id))?.role).toBe("admin");
  });

  it("allows demoting an admin while another admin remains", async () => {
    const db = await freshDb();
    const chef = await seedAdmin(db, "chef");
    await seedAdmin(db, "vize");
    await setRole(db, chef.id, "user");
    expect((await findUserById(db, chef.id))?.role).toBe("user");
    expect(await countAdmins(db)).toBe(1);
  });

  it("refuses a role other than admin and user", async () => {
    const db = await freshDb();
    const chef = await seedAdmin(db);

    await expect(setRole(db, chef.id, "superadmin" as Bad)).rejects.toThrow(
      new ValidationError("Unbekannte Rolle."),
    );
  });
});

describe("resetPassword", () => {
  it("sets a new hashed password", async () => {
    const db = await freshDb();
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await resetPassword(db, anna.id, "brand-new-pass");
    expect(
      await verifyPassword(
        "brand-new-pass",
        (await findUserById(db, anna.id))!.passwordHash,
      ),
    ).toBe(true);
  });

  it("rejects a too-short new password", async () => {
    const db = await freshDb();
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await expect(resetPassword(db, anna.id, "short")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("refuses a number as new password", async () => {
    const db = await freshDb();
    const chef = await seedAdmin(db);

    await expect(resetPassword(db, chef.id, 7 as Bad)).rejects.toThrow(
      new ValidationError("Das Passwort muss Text sein."),
    );
  });

  it.each(REFUSED_PASSWORDS)(
    "refuses a password $rule and keeps the old one",
    async ({ password, message }) => {
      const db = await freshDb();
      const user = await seedAdmin(db, POLICY_USERNAME);

      await expect(resetPassword(db, user.id, password)).rejects.toThrow(
        new ValidationError(message),
      );
      expect(await passwordIs(db, user.id, "admin-secret-1")).toBe(true);
    },
  );

  it("revokes the user's open sessions", async () => {
    const db = await freshDb();
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await insertSession(db, {
      token: "anna-session",
      userId: anna.id,
      expiresAt: inAnHour(),
    });

    await resetPassword(db, anna.id, "brand-new-pass");

    expect(await findUserBySessionToken(db, "anna-session")).toBeNull();
  });
});

describe("changePassword (self-service)", () => {
  it("changes the password when the current one is correct and revokes sessions", async () => {
    const db = await freshDb();
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await insertSession(db, {
      token: "anna-session",
      userId: anna.id,
      expiresAt: inAnHour(),
    });

    await changePassword(
      db,
      new LoginRateLimiter(),
      "10.0.0.1",
      anna.id,
      "a-good-password",
      "brand-new-pass",
    );

    const stored = (await findUserById(db, anna.id))!.passwordHash;
    expect(await verifyPassword("brand-new-pass", stored)).toBe(true);
    expect(await findUserBySessionToken(db, "anna-session")).toBeNull();
  });

  it("rejects a wrong current password and leaves password and sessions intact", async () => {
    const db = await freshDb();
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await insertSession(db, {
      token: "anna-session",
      userId: anna.id,
      expiresAt: inAnHour(),
    });

    await expect(
      changePassword(
        db,
        new LoginRateLimiter(),
        "10.0.0.1",
        anna.id,
        "wrong-password",
        "brand-new-pass",
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    const stored = (await findUserById(db, anna.id))!.passwordHash;
    expect(await verifyPassword("a-good-password", stored)).toBe(true);
    expect(await findUserBySessionToken(db, "anna-session")).not.toBeNull();
  });

  it("refuses the 6th check of the current password, even the right one", async () => {
    const db = await freshDb();
    const { id } = await seedAdmin(db, "anna");
    const limiter = new LoginRateLimiter();
    const change = (current: string) =>
      changePassword(db, limiter, "10.0.0.1", id, current, "brand-new-pass");

    for (let i = 0; i < 5; i++) {
      await expect(change("wrong-password")).rejects.toThrow(
        new ValidationError(WRONG_CURRENT),
      );
    }

    await expect(change("admin-secret-1")).rejects.toThrow(
      new ValidationError(RATE_LIMITED_MESSAGE),
    );
    expect(await passwordIs(db, id, "admin-secret-1")).toBe(true);
  });

  it("does not count a successful change as a failure", async () => {
    const db = await freshDb();
    const { id } = await seedAdmin(db, "anna");
    const limiter = new LoginRateLimiter();
    const change = (current: string, next: string) =>
      changePassword(db, limiter, "10.0.0.1", id, current, next);
    for (let i = 0; i < 4; i++) {
      await expect(change("wrong-password", "brand-new-pass")).rejects.toThrow(
        new ValidationError(WRONG_CURRENT),
      );
    }

    await change("admin-secret-1", "brand-new-pass");
    await expect(change("wrong-password", "brand-new-pass")).rejects.toThrow(
      new ValidationError(WRONG_CURRENT),
    );
    await change("brand-new-pass", "third-password");

    expect(await passwordIs(db, id, "third-password")).toBe(true);
  });

  it.each(REFUSED_PASSWORDS)(
    "refuses a new password $rule and keeps the old one",
    async ({ password, message }) => {
      const db = await freshDb();
      const { id } = await seedAdmin(db, POLICY_USERNAME);

      await expect(
        changePassword(
          db,
          new LoginRateLimiter(),
          "10.0.0.1",
          id,
          "admin-secret-1",
          password,
        ),
      ).rejects.toThrow(new ValidationError(message));
      expect(await passwordIs(db, id, "admin-secret-1")).toBe(true);
    },
  );
});

describe("deleteAccount (last-admin protection)", () => {
  it("blocks deleting the last remaining admin", async () => {
    const db = await freshDb();
    const chef = await seedAdmin(db);
    await expect(deleteAccount(db, chef.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await findUserById(db, chef.id)).not.toBeNull();
  });

  it("deletes a non-last account", async () => {
    const db = await freshDb();
    await seedAdmin(db);
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await deleteAccount(db, anna.id);
    expect(await findUserById(db, anna.id)).toBeNull();
  });

  it("leaves the deleted user's ETB entries readable with their author snapshot", async () => {
    const db = await freshDb();
    await seedAdmin(db);
    const anna = await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    const op = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });
    await appendEntry(db, {
      operationId: op.id,
      text: "Lage",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });

    await deleteAccount(db, anna.id);

    const [entry] = await listEntries(db, op.id);
    expect(entry).toMatchObject({ text: "Lage", author: "anna" });
  });
});

describe("refusing a Nutzer-ID that is not a UUID", () => {
  it.each([
    ["setting a role", (db: Db) => setRole(db, "user-1", "admin")],
    [
      "resetting a password",
      (db: Db) => resetPassword(db, "user-1", "a-good-password"),
    ],
    ["deleting an account", (db: Db) => deleteAccount(db, "user-1")],
  ])("refuses %s", async (_, call) => {
    const db = await freshDb();
    await seedAdmin(db);

    await expect(call(db)).rejects.toThrow(
      new ValidationError("Ungültige ID."),
    );
  });
});

describe("refusing a Nutzer that no longer exists", () => {
  it.each([
    ["promoting", (db: Db, id: string) => setRole(db, id, "admin")],
    ["demoting", (db: Db, id: string) => setRole(db, id, "user")],
    [
      "resetting a password",
      (db: Db, id: string) => resetPassword(db, id, "a-good-password"),
    ],
  ])("refuses %s", async (_, call) => {
    const db = await freshDb();

    await expect(call(db, randomUUID())).rejects.toThrow(
      new ValidationError("Nutzer nicht gefunden."),
    );
  });
});

async function passwordIs(db: Db, id: string, password: string) {
  const user = await findUserById(db, id);
  return user !== null && (await verifyPassword(password, user.passwordHash));
}
