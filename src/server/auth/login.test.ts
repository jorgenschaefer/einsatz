import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import { authenticate, createSession, SESSION_TTL_MS } from "./login";
import { hashPassword } from "./password";
import { findUserBySessionToken, insertSession } from "./sessions";
import { insertUser } from "./users";

async function seedAnna(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertUser(db, {
    username: "anna",
    passwordHash: await hashPassword("a-good-password"),
    role: "user",
  });
}

describe("authenticate", () => {
  it("returns the user for correct credentials", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    expect(await authenticate(db, "anna", "a-good-password")).toMatchObject({
      id: user.id,
    });
    await db.close();
  });

  it("returns null for a wrong password", async () => {
    const db = await freshDb();
    await seedAnna(db);
    expect(await authenticate(db, "anna", "wrong-password!")).toBeNull();
    await db.close();
  });

  it("returns null for an unknown user", async () => {
    const db = await freshDb();
    expect(await authenticate(db, "ghost", "whatever-1234")).toBeNull();
    await db.close();
  });
});

describe("createSession", () => {
  it("creates a session that resolves to the user, valid for ~30 days", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const now = 1_000_000;
    const { token, expiresAt } = await createSession(db, user.id, now);

    expect(expiresAt.getTime()).toBe(now + SESSION_TTL_MS);
    const before = await findUserBySessionToken(
      db,
      token,
      new Date(now + SESSION_TTL_MS - 1),
    );
    expect(before).toMatchObject({ id: user.id });
    const after = await findUserBySessionToken(
      db,
      token,
      new Date(now + SESSION_TTL_MS + 1),
    );
    expect(after).toBeNull();
    await db.close();
  });

  it("creates distinct tokens each time", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const a = await createSession(db, user.id);
    const b = await createSession(db, user.id);
    expect(a.token).not.toBe(b.token);
    await db.close();
  });

  it("purges expired sessions when a new one is created (purge-on-write)", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    await insertSession(db, {
      token: "stale",
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    await createSession(db, user.id);

    const { rows } = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM sessions WHERE token = 'stale'",
    );
    expect(rows[0].count).toBe("0");
    await db.close();
  });

  it("still logs in when the best-effort purge fails", async () => {
    // A db whose INSERT succeeds but whose purge DELETE rejects.
    const inserted: string[] = [];
    const db = {
      query: async (text: string, params?: readonly unknown[]) => {
        if (text.startsWith("DELETE")) throw new Error("purge boom");
        if (text.startsWith("INSERT"))
          inserted.push(String(params?.[0] ?? ""));
        return { rows: [] };
      },
    } as unknown as Parameters<typeof createSession>[0];

    const { token } = await createSession(db, "user-1");
    expect(token).toBeTruthy();
    expect(inserted).toHaveLength(1); // the session was written despite the purge failure
  });
});
