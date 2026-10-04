import { describe, expect, it, vi } from "vitest";
import type { Queryable } from "@/server/db/db";
import { freshDb } from "@/test/db";
import { attemptLogin, authenticate, createSession } from "./login";
import { hashPassword } from "./password";
import { LoginRateLimiter } from "./rate-limit";
import {
  findUserBySessionToken,
  insertSession,
  recordSessionUse,
} from "./sessions";
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
  });

  it("returns null for a wrong password", async () => {
    const db = await freshDb();
    await seedAnna(db);
    expect(await authenticate(db, "anna", "wrong-password!")).toBeNull();
  });

  it("returns null for an unknown user", async () => {
    const db = await freshDb();
    expect(await authenticate(db, "ghost", "whatever-1234")).toBeNull();
  });
});

describe("attemptLogin", () => {
  const IP = "10.0.0.1";

  it("returns ok with the user for correct credentials", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const result = await attemptLogin(
      db,
      new LoginRateLimiter(),
      IP,
      "anna",
      "a-good-password",
    );
    expect(result).toEqual({ status: "ok", user });
  });

  it("counts a wrong password and refuses even the correct one once the pair budget is used up", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 1000, 60_000);
    expect(
      await attemptLogin(db, limiter, IP, "anna", "wrong-1!!!!!!"),
    ).toEqual({ status: "invalid" });
    await attemptLogin(db, limiter, IP, "anna", "wrong-2!!!!!!");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result).toEqual({ status: "rate-limited" });
  });

  it("resets the pair failure count on a successful login", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 1000, 60_000);
    await attemptLogin(db, limiter, IP, "anna", "wrong!!!!!!!");
    await attemptLogin(db, limiter, IP, "anna", "a-good-password");
    await attemptLogin(db, limiter, IP, "anna", "wrong!!!!!!!");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
  });

  it("does not count a successful login against the IP budget", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(5, 1, 60_000);
    await attemptLogin(db, limiter, IP, "anna", "a-good-password");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
  });

  it("does not count an attempt whose check fails, and passes the error on", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(1, 1, 60_000);
    const down: Queryable = {
      query: () => Promise.reject(new Error("database down")),
    };
    await expect(
      attemptLogin(down, limiter, IP, "anna", "a-good-password"),
    ).rejects.toThrow("database down");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
  });
});

describe("createSession", () => {
  it("creates a session that resolves to the user, valid for ~30 days", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const now = 1_000_000;
    const thirtyDays = 30 * 24 * 60 * 60_000;
    const { token, expiresAt } = await createSession(db, user.id, now);

    expect(expiresAt.getTime()).toBe(now + thirtyDays);
    await recordSessionUse(db, token, new Date(now + thirtyDays - 60_000));
    const before = await findUserBySessionToken(
      db,
      token,
      new Date(now + thirtyDays - 1),
    );
    expect(before).toMatchObject({ id: user.id });
    const after = await findUserBySessionToken(
      db,
      token,
      new Date(now + thirtyDays),
    );
    expect(after).toBeNull();
  });

  it("counts the login as the session's last use", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const now = 1_000_000;
    const { token } = await createSession(db, user.id, now);

    const idleBound = (24 * 60 + 5) * 60_000;
    expect(
      await findUserBySessionToken(db, token, new Date(now + idleBound - 1000)),
    ).toMatchObject({ id: user.id });
    expect(
      await findUserBySessionToken(db, token, new Date(now + idleBound + 1000)),
    ).toBeNull();
  });

  it("creates distinct tokens each time", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const a = await createSession(db, user.id);
    const b = await createSession(db, user.id);
    expect(a.token).not.toBe(b.token);
  });

  it("purges expired sessions when a new one is created (purge-on-write)", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    await insertSession(db, {
      token: "stale",
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    const fresh = await createSession(db, user.id);

    const { rows } = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM sessions",
    );
    expect(rows[0].count).toBe("1");
    expect(await findUserBySessionToken(db, fresh.token)).not.toBeNull();
  });

  it("still logs in when the best-effort purge fails", async () => {
    // A db whose INSERT succeeds but whose purge DELETE rejects.
    const purgeBoom = new Error("purge boom");
    const inserted: string[] = [];
    const db = {
      query: async (text: string, params?: readonly unknown[]) => {
        if (text.startsWith("DELETE")) throw purgeBoom;
        if (text.startsWith("INSERT")) inserted.push(String(params?.[0] ?? ""));
        return { rows: [] };
      },
    } as unknown as Parameters<typeof createSession>[0];

    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const { token } = await createSession(db, "user-1");
    expect(token).toBeTruthy();
    expect(inserted).toHaveLength(1); // the session was written despite the purge failure
    expect(errorLog).toHaveBeenCalledWith(
      "Aufräumen abgelaufener Sessions fehlgeschlagen:",
      purgeBoom,
    );
    errorLog.mockRestore();
  });
});
