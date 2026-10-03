import { randomBytes } from "node:crypto";
import type { Db, Queryable } from "@/server/db/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";
import type { LoginRateLimiter } from "./rate-limit";
import { deleteExpiredSessions, insertSession } from "./sessions";
import type { User } from "./users";
import { findUserByUsername } from "./users";

/** Langlebige Anmeldung: „angemeldet bleiben" ~30 Tage. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

/** Ein Anmeldeversuch, gezählt gegen das Login-Limit. */
export async function attemptLogin(
  db: Queryable,
  limiter: LoginRateLimiter,
  ip: string,
  username: string,
  password: string,
): Promise<LoginAttempt> {
  const attempt = await limiter.attempt(ip, username, () =>
    authenticate(db, username, password),
  );
  if (attempt.status === "rate-limited") return attempt;
  if (!attempt.result) return { status: "invalid" };
  return { status: "ok", user: attempt.result };
}

/** Erzeugt eine Session und liefert deren Token samt Ablaufzeitpunkt. */
export async function createSession(
  db: Db,
  userId: string,
  now: number = Date.now(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + SESSION_TTL_MS);
  await insertSession(db, { token, userId, expiresAt }, new Date(now));
  // Best-effort-Aufräumen abgelaufener Sessions (Purge-on-write). Ein Fehler
  // hier darf die Anmeldung nie blockieren.
  try {
    await deleteExpiredSessions(db, new Date(now));
  } catch (err) {
    console.error("Aufräumen abgelaufener Sessions fehlgeschlagen:", err);
  }
  return { token, expiresAt };
}
