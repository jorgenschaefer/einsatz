import type { Queryable } from "@/server/db/db";
import type { AuthenticatedUser, Role } from "./users";

export async function insertSession(
  db: Queryable,
  session: { token: string; userId: string; expiresAt: Date },
): Promise<void> {
  await db.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [session.token, session.userId, session.expiresAt.toISOString()],
  );
}

/** Beendet eine einzelne Session (Abmelden am aktuellen Gerät). */
export async function deleteSession(
  db: Queryable,
  token: string,
): Promise<void> {
  await db.query("DELETE FROM sessions WHERE token = $1", [token]);
}

/** Widerruft alle Sessions eines Nutzers (z. B. nach Passwortänderung). */
export async function deleteSessionsForUser(
  db: Queryable,
  userId: string,
): Promise<void> {
  await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

interface JoinedRow {
  id: string;
  username: string;
  role: Role;
}

/**
 * Liefert den (hash-freien) Nutzer zu einem gültigen (nicht abgelaufenen)
 * Session-Token. Der Passwort-Hash bleibt bewusst außen vor – die Session-
 * Auflösung braucht ihn nicht und er soll nicht breit weitergereicht werden.
 */
export async function findUserBySessionToken(
  db: Queryable,
  token: string,
  now: Date = new Date(),
): Promise<AuthenticatedUser | null> {
  const { rows } = await db.query<JoinedRow>(
    `SELECT u.id, u.username, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > $2`,
    [token, now.toISOString()],
  );
  const row = rows[0];
  return row ? { id: row.id, username: row.username, role: row.role } : null;
}
