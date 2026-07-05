import { randomBytes } from "node:crypto";
import type { Db, Queryable } from "@/server/db/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";
import type { LoginRateLimiter } from "./rate-limit";
import { insertSession } from "./sessions";
import type { User } from "./users";
import { findUserByUsername } from "./users";

/** Langlebige Anmeldung: „angemeldet bleiben" ~30 Tage. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Prüft Anmeldedaten. Liefert den Nutzer oder null (Aufrufer meldet generisch). */
export async function authenticate(
  db: Queryable,
  username: string,
  password: string,
): Promise<User | null> {
  const user = await findUserByUsername(db, username);
  if (!user) {
    // Gegen einen Dummy-Hash vergleichen, um die Antwortzeit anzugleichen.
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return user;
}

export type LoginAttempt =
  | { status: "ok"; user: User }
  | { status: "rate-limited" }
  | { status: "invalid" };

/**
 * Ein Anmeldeversuch inkl. Rate-Limit: blockt gesperrte Schlüssel vorab,
 * zählt Fehlversuche und setzt den Zähler bei Erfolg zurück.
 */
export async function attemptLogin(
  db: Queryable,
  limiter: LoginRateLimiter,
  key: string,
  username: string,
  password: string,
): Promise<LoginAttempt> {
  if (limiter.isBlocked(key)) return { status: "rate-limited" };

  const user = await authenticate(db, username, password);
  if (!user) {
    limiter.recordFailure(key);
    return { status: "invalid" };
  }

  limiter.reset(key);
  return { status: "ok", user };
}

/** Erzeugt eine Session und liefert deren Token samt Ablaufzeitpunkt. */
export async function createSession(
  db: Db,
  userId: string,
  now: number = Date.now(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + SESSION_TTL_MS);
  await insertSession(db, { token, userId, expiresAt });
  return { token, expiresAt };
}
