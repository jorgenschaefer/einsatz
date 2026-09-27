import { describe, expect, it } from "vitest";
import { appendEntry, listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  changePassword,
  createAccount,
  deleteAccount,
  resetPassword,
  setRole,
} from "./account-admin";
import { hashPassword, verifyPassword } from "./password";
import { findUserBySessionToken, insertSession } from "./sessions";
import {
  countAdmins,
  findUserById,
  findUserByUsername,
  insertUser,
} from "./users";

const inAnHour = () => new Date(Date.now() + 60 * 60_000);

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

  it("rejects a duplicate username", async () => {
    const db = await freshDb();
    await createAccount(db, {
      username: "anna",
      password: "a-good-password",
      role: "user",
    });
    await expect(
      createAccount(db, {
        username: "anna",
        password: "another-pass1",
        role: "user",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a too-short password and creates nothing", async () => {
    const db = await freshDb();
    await expect(
      createAccount(db, { username: "anna", password: "short", role: "user" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await findUserByUsername(db, "anna")).toBeNull();
  });
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

    await changePassword(db, anna.id, "a-good-password", "brand-new-pass");

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
      changePassword(db, anna.id, "wrong-password", "brand-new-pass"),
    ).rejects.toBeInstanceOf(ValidationError);

    const stored = (await findUserById(db, anna.id))!.passwordHash;
    expect(await verifyPassword("a-good-password", stored)).toBe(true);
    expect(await findUserBySessionToken(db, "anna-session")).not.toBeNull();
  });
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
    });

    await deleteAccount(db, anna.id);

    const [entry] = await listEntries(db, op.id);
    expect(entry).toMatchObject({ text: "Lage", author: "anna" });
  });
});
