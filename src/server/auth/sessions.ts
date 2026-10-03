import { createHash } from "node:crypto";
import type { Queryable } from "@/server/db/db";
import type { AuthenticatedUser, Role } from "./users";

/** Ohne Nutzung endet eine Sitzung nach 24 Stunden. */
const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;

/**
 * Die letzte Nutzung wird höchstens so oft geschrieben; die Leerlaufprüfung
 * gibt diesen Nachlauf dazu, damit keine Sitzung vor 24 Stunden endet.
 */
const SESSION_USE_WRITE_INTERVAL_MS = 5 * 60 * 1000;

/** Eine neue Session gilt ab `now` als zuletzt genutzt. */
export async function insertSession(
  db: Queryable,
  session: { token: string; userId: string; expiresAt: Date },
  now: Date = new Date(),
): Promise<void> {
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at)
     VALUES ($1, $2, $3, $4)`,
    [
      hashSessionToken(session.token),
      session.userId,
      session.expiresAt.toISOString(),
      now.toISOString(),
    ],
  );
}

/**
 * Hält fest, dass der Nutzer die Session gerade genutzt hat, höchstens alle
 * 5 Minuten ein Schreibvorgang.
 */
export async function recordSessionUse(
  db: Queryable,
  token: string,
  now: Date = new Date(),
): Promise<void> {
  await db.query(
    `UPDATE sessions SET last_seen_at = $2
      WHERE token_hash = $1 AND last_seen_at <= $3`,
    [
      hashSessionToken(token),
      now.toISOString(),
      new Date(now.getTime() - SESSION_USE_WRITE_INTERVAL_MS).toISOString(),
    ],
  );
}

/** Beendet eine einzelne Session (Abmelden am aktuellen Gerät). */
export async function deleteSession(
  db: Queryable,
  token: string,
): Promise<void> {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [
    hashSessionToken(token),
  ]);
}

/**
 * Räumt abgelaufene und zu lange ungenutzte Sessions weg (Purge-on-write,
 * kein Scheduler nötig).
 */
export async function deleteExpiredSessions(
  db: Queryable,
  now: Date = new Date(),
): Promise<void> {
  await db.query(
    "DELETE FROM sessions WHERE expires_at <= $1 OR last_seen_at <= $2",
    [now.toISOString(), idleCutoff(now).toISOString()],
  );
}

/** Widerruft alle Sessions eines Nutzers (z. B. nach Passwortänderung). */
export async function deleteSessionsForUser(
  db: Queryable,
  userId: string,
): Promise<void> {
  await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

/** „Überall abmelden": beendet alle Sessions des Nutzers außer dieser. */
export async function deleteOtherSessionsOfUser(
  db: Queryable,
  userId: string,
  keepToken: string,
): Promise<void> {
  await db.query(
    "DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2",
    [userId, hashSessionToken(keepToken)],
  );
}

interface JoinedRow {
  id: string;
  username: string;
  role: Role;
}

/**
 * Liefert den (hash-freien) Nutzer zu einem gültigen (nicht abgelaufenen,
 * nicht zu lange ungenutzten) Session-Token. Schreibt nichts: ob die Anfrage
 * eine Nutzung war, entscheidet der Aufrufer. Der Passwort-Hash bleibt bewusst
 * außen vor – die Session-Auflösung braucht ihn nicht und er soll nicht breit
 * weitergereicht werden.
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
      WHERE s.token_hash = $1 AND s.expires_at > $2 AND s.last_seen_at > $3`,
    [hashSessionToken(token), now.toISOString(), idleCutoff(now).toISOString()],
  );
  const row = rows[0];
  return row ? { id: row.id, username: row.username, role: row.role } : null;
}

/** Wer zuletzt vor diesem Zeitpunkt genutzt wurde, ist zu lange ungenutzt. */
function idleCutoff(now: Date): Date {
  return new Date(
    now.getTime() - SESSION_IDLE_MS - SESSION_USE_WRITE_INTERVAL_MS,
  );
}

/** Nur der Hash liegt in der DB: wer die Tabelle liest, hat keine Sitzung. */
function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
