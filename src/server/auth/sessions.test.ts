import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import {
  deleteSession,
  deleteSessionsForUser,
  findUserBySessionToken,
  insertSession,
} from "./sessions";
import { insertUser } from "./users";

const soon = () => new Date(Date.now() + 1000);

async function seedUser(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertUser(db, { username: "anna", passwordHash: "h", role: "user" });
}

describe("sessions repository", () => {
  it("resolves a valid token to its user", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    await insertSession(db, {
      token: "tok",
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000),
    });

    const found = await findUserBySessionToken(db, "tok");
    expect(found).toMatchObject({ id: user.id, username: "anna" });
    await db.close();
  });

  it("returns null for an expired token", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    const expiresAt = new Date(Date.now() - 1000);
    await insertSession(db, { token: "old", userId: user.id, expiresAt });

    expect(await findUserBySessionToken(db, "old")).toBeNull();
    await db.close();
  });

  it("returns null for an unknown token", async () => {
    const db = await freshDb();
    expect(await findUserBySessionToken(db, "nope")).toBeNull();
    await db.close();
  });

  it("deletes a single session by token, leaving the others", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    await insertSession(db, {
      token: "keep",
      userId: user.id,
      expiresAt: soon(),
    });
    await insertSession(db, {
      token: "drop",
      userId: user.id,
      expiresAt: soon(),
    });

    await deleteSession(db, "drop");

    expect(await findUserBySessionToken(db, "drop")).toBeNull();
    expect(await findUserBySessionToken(db, "keep")).not.toBeNull();
    await db.close();
  });

  it("revokes every session of one user, leaving another user's intact", async () => {
    const db = await freshDb();
    const anna = await seedUser(db);
    const bob = await insertUser(db, {
      username: "bob",
      passwordHash: "h",
      role: "user",
    });
    await insertSession(db, {
      token: "anna1",
      userId: anna.id,
      expiresAt: soon(),
    });
    await insertSession(db, {
      token: "anna2",
      userId: anna.id,
      expiresAt: soon(),
    });
    await insertSession(db, {
      token: "bob1",
      userId: bob.id,
      expiresAt: soon(),
    });

    await deleteSessionsForUser(db, anna.id);

    expect(await findUserBySessionToken(db, "anna1")).toBeNull();
    expect(await findUserBySessionToken(db, "anna2")).toBeNull();
    expect(await findUserBySessionToken(db, "bob1")).not.toBeNull();
    await db.close();
  });
});
