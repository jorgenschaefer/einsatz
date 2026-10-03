import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import {
  deleteExpiredSessions,
  deleteSession,
  deleteSessionsForUser,
  findUserBySessionToken,
  insertSession,
  recordSessionUse,
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
    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM sessions",
    );
    expect(rows[0].count).toBe(1);
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

  it("stores only a hash of the token, which is not itself a token", async () => {
    const db = await freshDb();
    const user = await seedUser(db);
    await insertSession(db, {
      token: "tok",
      userId: user.id,
      expiresAt: inAnHour(),
    });

    const { rows } = await db.query<{ token_hash: string }>(
      "SELECT token_hash FROM sessions",
    );
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await findUserBySessionToken(db, rows[0].token_hash)).toBeNull();
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

describe("session idle timeout", () => {
  const MINUTE = 60_000;
  const IDLE_BOUND = 24 * 60 * MINUTE + 5 * MINUTE;
  const start = new Date("2026-10-01T08:00:00Z");
  const sinceStart = (ms: number) => new Date(start.getTime() + ms);
  const in30Days = sinceStart(30 * 24 * 60 * MINUTE);

  async function sessionStartedAtStart(
    db: Awaited<ReturnType<typeof freshDb>>,
  ) {
    const user = await seedUser(db);
    await insertSession(
      db,
      { token: "tok", userId: user.id, expiresAt: in30Days },
      start,
    );
    return user;
  }

  async function lastSeenAt(db: Awaited<ReturnType<typeof freshDb>>) {
    const { rows } = await db.query<{ last_seen_at: Date }>(
      "SELECT last_seen_at FROM sessions",
    );
    return rows[0].last_seen_at;
  }

  it("resolves the token until 24 h 5 min after the last recorded use", async () => {
    const db = await freshDb();
    await sessionStartedAtStart(db);

    expect(
      await findUserBySessionToken(db, "tok", sinceStart(IDLE_BOUND - 1000)),
    ).not.toBeNull();
    expect(
      await findUserBySessionToken(db, "tok", sinceStart(IDLE_BOUND + 1000)),
    ).toBeNull();
  });

  it("extends the session from a recorded use", async () => {
    const db = await freshDb();
    await sessionStartedAtStart(db);

    await recordSessionUse(db, "tok", sinceStart(10 * MINUTE));

    expect(
      await findUserBySessionToken(
        db,
        "tok",
        sinceStart(10 * MINUTE + IDLE_BOUND - 1000),
      ),
    ).not.toBeNull();
  });

  it("never ends a session before 24 h after a use that was not written down", async () => {
    const db = await freshDb();
    await sessionStartedAtStart(db);
    await recordSessionUse(db, "tok", sinceStart(10 * MINUTE));
    const unwritten = 10 * MINUTE + 5 * MINUTE - 1000;
    await recordSessionUse(db, "tok", sinceStart(unwritten));
    expect(await lastSeenAt(db)).toEqual(sinceStart(10 * MINUTE));

    expect(
      await findUserBySessionToken(
        db,
        "tok",
        sinceStart(unwritten + 24 * 60 * MINUTE - 1000),
      ),
    ).not.toBeNull();
  });

  it("writes a use at most every 5 minutes", async () => {
    const db = await freshDb();
    await sessionStartedAtStart(db);

    await recordSessionUse(db, "tok", sinceStart(2 * MINUTE));
    expect(await lastSeenAt(db)).toEqual(start);
    await recordSessionUse(db, "tok", sinceStart(5 * MINUTE));
    expect(await lastSeenAt(db)).toEqual(sinceStart(5 * MINUTE));
    await recordSessionUse(db, "tok", sinceStart(11 * MINUTE));
    expect(await lastSeenAt(db)).toEqual(sinceStart(11 * MINUTE));
  });

  it("purges idle sessions along with expired ones", async () => {
    const db = await freshDb();
    const user = await sessionStartedAtStart(db);
    await insertSession(
      db,
      { token: "fresh", userId: user.id, expiresAt: in30Days },
      sinceStart(IDLE_BOUND),
    );

    await deleteExpiredSessions(db, sinceStart(IDLE_BOUND + 1000));

    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM sessions",
    );
    expect(rows[0].count).toBe(1);
    expect(
      await findUserBySessionToken(db, "fresh", sinceStart(IDLE_BOUND + 1000)),
    ).not.toBeNull();
  });
});
