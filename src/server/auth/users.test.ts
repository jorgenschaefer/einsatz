import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import {
  countAdmins,
  countUsers,
  deleteUser,
  findUserById,
  findUserByUsername,
  insertUser,
  listUsers,
  updateUserPasswordHash,
  updateUserRole,
} from "./users";

describe("users repository", () => {
  it("inserts a user and finds it by username", async () => {
    const db = await freshDb();
    const created = await insertUser(db, {
      username: "anna",
      passwordHash: "h",
      role: "admin",
    });
    expect(created.id).toBeTruthy();

    const found = await findUserByUsername(db, "anna");
    expect(found).toMatchObject({
      username: "anna",
      passwordHash: "h",
      role: "admin",
    });
    await db.close();
  });

  it("returns null for an unknown username", async () => {
    const db = await freshDb();
    expect(await findUserByUsername(db, "nobody")).toBeNull();
    await db.close();
  });

  it("rejects a duplicate username", async () => {
    const db = await freshDb();
    await insertUser(db, { username: "anna", passwordHash: "h", role: "user" });
    await expect(
      insertUser(db, { username: "anna", passwordHash: "x", role: "user" }),
    ).rejects.toThrow();
    await db.close();
  });

  it("counts users", async () => {
    const db = await freshDb();
    expect(await countUsers(db)).toBe(0);
    await insertUser(db, {
      username: "anna",
      passwordHash: "h",
      role: "admin",
    });
    expect(await countUsers(db)).toBe(1);
    await db.close();
  });

  it("lists users alphabetically and finds by id", async () => {
    const db = await freshDb();
    await insertUser(db, { username: "bob", passwordHash: "h", role: "user" });
    const anna = await insertUser(db, {
      username: "anna",
      passwordHash: "h",
      role: "admin",
    });
    expect((await listUsers(db)).map((u) => u.username)).toEqual([
      "anna",
      "bob",
    ]);
    expect(await findUserById(db, anna.id)).toMatchObject({ username: "anna" });
    expect(
      await findUserById(db, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
    await db.close();
  });

  it("updates role and password, and counts admins", async () => {
    const db = await freshDb();
    const u = await insertUser(db, {
      username: "anna",
      passwordHash: "h",
      role: "user",
    });
    expect(await countAdmins(db)).toBe(0);
    await updateUserRole(db, u.id, "admin");
    expect(await countAdmins(db)).toBe(1);
    await updateUserPasswordHash(db, u.id, "newhash");
    expect((await findUserById(db, u.id))?.passwordHash).toBe("newhash");
    await db.close();
  });

  it("deletes a user", async () => {
    const db = await freshDb();
    const u = await insertUser(db, {
      username: "anna",
      passwordHash: "h",
      role: "user",
    });
    await deleteUser(db, u.id);
    expect(await findUserById(db, u.id)).toBeNull();
    await db.close();
  });
});
