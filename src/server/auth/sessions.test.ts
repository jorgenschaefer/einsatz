import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import {
  deleteExpiredSessions,
  deleteSession,
  deleteSessionsForUser,
  findUserBySessionToken,
  insertSession,
} from "./sessions";
import { insertUser } from "./users";

const inAnHour = () => new Date(Date.now() + 60 * 60_000);

async function seedUser(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertUser(db, { username: "anna", passwordHash: "h", role: "user" });
}

describe("deleteExpiredSessions", () => {
  it("removes only the expired sessions, keeping the valid ones", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    const now = new Date();
    await insertSession(db, {
      token: "expired",
      userId: user.id,
      expiresAt: new Date(now.getTime() - 1000),
    });
    await insertSession(db, {
      token: "valid",
      userId: user.id,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    await deleteExpiredSessions(db, now);

    // The valid session still resolves; the expired row is gone.
    expect(await findUserBySessionToken(db, "valid", now)).not.toBeNull();
    const { rows } = await db.query<{ token: string }>(
      "SELECT token FROM sessions ORDER BY token",
    );
    expect(rows.map((r) => r.token)).toEqual(["valid"]);
  });
});

describe("sessions repository", () => {
  it("resolves a valid token to its user", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    await insertSession(db, {
      token: "tok",
      userId: user.id,
      expiresAt: inAnHour(),
    });

    const found = await findUserBySessionToken(db, "tok");
    expect(found).toMatchObject({ id: user.id, username: "anna" });
    // Der breit gereichte Identitätstyp trägt keinen Passwort-Hash.
    expect(found).not.toHaveProperty("passwordHash");
  });

  it("returns null for an expired token", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    const expiresAt = new Date(Date.now() - 1000);
    await insertSession(db, { token: "old", userId: user.id, expiresAt });

    expect(await findUserBySessionToken(db, "old")).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    const db = await freshDb();
    expect(await findUserBySessionToken(db, "nope")).toBeNull();
  });

  it("deletes a single session by token, leaving the others", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    await insertSession(db, {
      token: "keep",
      userId: user.id,
      expiresAt: inAnHour(),
    });
    await insertSession(db, {
      token: "drop",
      userId: user.id,
      expiresAt: inAnHour(),
    });

    await deleteSession(db, "drop");

    expect(await findUserBySessionToken(db, "drop")).toBeNull();
    expect(await findUserBySessionToken(db, "keep")).not.toBeNull();
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
      expiresAt: inAnHour(),
    });
    await insertSession(db, {
      token: "anna2",
      userId: anna.id,
      expiresAt: inAnHour(),
    });
    await insertSession(db, {
      token: "bob1",
      userId: bob.id,
      expiresAt: inAnHour(),
    });

    await deleteSessionsForUser(db, anna.id);

    expect(await findUserBySessionToken(db, "anna1")).toBeNull();
    expect(await findUserBySessionToken(db, "anna2")).toBeNull();
    expect(await findUserBySessionToken(db, "bob1")).not.toBeNull();
  });
});
