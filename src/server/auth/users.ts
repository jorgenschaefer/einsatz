import { randomUUID } from "node:crypto";
import type { Queryable } from "@/server/db/db";

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  role: row.role,
});

export async function insertUser(
  db: Queryable,
  user: { username: string; passwordHash: string; role: Role },
): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (id, username, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, password_hash, role`,
    [randomUUID(), user.username, user.passwordHash, user.role],
  );
  return toUser(rows[0]);
}

export async function findUserByUsername(
  db: Queryable,
  username: string,
): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, username, password_hash, role FROM users WHERE username = $1`,
    [username],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserById(
  db: Queryable,
  id: string,
): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, username, password_hash, role FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

/** Alle Konten, alphabetisch nach Nutzername. */
export async function listUsers(db: Queryable): Promise<User[]> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, username, password_hash, role FROM users ORDER BY username ASC`,
  );
  return rows.map(toUser);
}

export async function updateUserRole(
  db: Queryable,
  id: string,
  role: Role,
): Promise<void> {
  await db.query("UPDATE users SET role = $2 WHERE id = $1", [id, role]);
}

export async function updateUserPasswordHash(
  db: Queryable,
  id: string,
  passwordHash: string,
): Promise<void> {
  await db.query("UPDATE users SET password_hash = $2 WHERE id = $1", [
    id,
    passwordHash,
  ]);
}

export async function deleteUser(db: Queryable, id: string): Promise<void> {
  await db.query("DELETE FROM users WHERE id = $1", [id]);
}

export async function countUsers(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM users",
  );
  return Number(rows[0].count);
}

export async function countAdmins(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM users WHERE role = 'admin'",
  );
  return Number(rows[0].count);
}
