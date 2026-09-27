import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import { verifyPassword } from "./password";
import { seedAdmin } from "./seed";
import { countUsers, findUserByUsername } from "./users";

describe("seedAdmin", () => {
  it("creates exactly one admin with a hashed password on an empty database", async () => {
    const db = await freshDb();
    await seedAdmin(db, { username: "chef", password: "super-secret-1" });

    expect(await countUsers(db)).toBe(1);
    const admin = await findUserByUsername(db, "chef");
    expect(admin?.role).toBe("admin");
    expect(admin?.passwordHash).not.toBe("super-secret-1");
    expect(await verifyPassword("super-secret-1", admin!.passwordHash)).toBe(
      true,
    );
  });

  it("is idempotent: running twice does not create a duplicate", async () => {
    const db = await freshDb();
    await seedAdmin(db, { username: "chef", password: "super-secret-1" });
    await seedAdmin(db, { username: "chef", password: "super-secret-1" });
    expect(await countUsers(db)).toBe(1);
  });

  it("leaves an existing account set untouched", async () => {
    const db = await freshDb();
    await seedAdmin(db, { username: "first", password: "super-secret-1" });
    await seedAdmin(db, { username: "second", password: "super-secret-2" });
    expect(await countUsers(db)).toBe(1);
    expect(await findUserByUsername(db, "second")).toBeNull();
  });

  it("rejects an admin password shorter than the minimum when seeding is needed", async () => {
    const db = await freshDb();
    await expect(
      seedAdmin(db, { username: "chef", password: "short" }),
    ).rejects.toThrow();
    expect(await countUsers(db)).toBe(0);
  });

  it("boots fine on an already-seeded database even if the configured password is now too short", async () => {
    const db = await freshDb();
    await seedAdmin(db, { username: "chef", password: "super-secret-1" });
    await expect(
      seedAdmin(db, { username: "chef", password: "short" }),
    ).resolves.toBeUndefined();
    expect(await countUsers(db)).toBe(1);
  });
});
