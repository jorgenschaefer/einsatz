import type { Db, Queryable } from "@/server/db/db";
import { ValidationError } from "@/server/validation";
import { hashPassword, verifyPassword } from "./password";
import { deleteSessionsForUser } from "./sessions";
import {
  countAdmins,
  deleteUser,
  findUserById,
  findUserByUsername,
  insertUser,
  type Role,
  type User,
  updateUserPasswordHash,
  updateUserRole,
} from "./users";

export async function createAccount(
  db: Db,
  input: { username: string; password: string; role: Role },
): Promise<User> {
  const username = input.username.trim();
  if (!username)
    throw new ValidationError("Der Nutzername darf nicht leer sein.");
  if (await findUserByUsername(db, username)) {
    throw new ValidationError("Dieser Nutzername ist bereits vergeben.");
  }
  const passwordHash = await hashPassword(input.password);
  return insertUser(db, { username, passwordHash, role: input.role });
}

export async function setRole(db: Db, id: string, role: Role): Promise<void> {
  if (role === "user") {
    await db.transaction(async (tx) => {
      await guardLastAdmin(tx, id, "zum Nutzer degradiert");
      await updateUserRole(tx, id, role);
    });
    return;
  }
  await updateUserRole(db, id, role);
}

/**
 * Setzt das Passwort neu und widerruft alle bestehenden Sessions des Nutzers,
 * damit ein zurückgesetztes Passwort auch offene Anmeldungen beendet.
 */
export async function resetPassword(
  db: Db,
  id: string,
  newPassword: string,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await updateUserPasswordHash(tx, id, passwordHash);
    await deleteSessionsForUser(tx, id);
  });
}

/**
 * Selbst-Passwortänderung: prüft zunächst das aktuelle Passwort, bevor
 * {@link resetPassword} das neue setzt und alle Sessions widerruft.
 */
export async function changePassword(
  db: Db,
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await findUserById(db, id);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ValidationError("Das aktuelle Passwort ist nicht korrekt.");
  }
  await resetPassword(db, id, newPassword);
}

export async function deleteAccount(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await guardLastAdmin(tx, id, "gelöscht");
    await deleteUser(tx, id);
  });
}

/** Wirft, wenn die Aktion den letzten verbleibenden Admin treffen würde. */
async function guardLastAdmin(
  tx: Queryable,
  id: string,
  verb: string,
): Promise<void> {
  const target = await findUserById(tx, id);
  if (target?.role !== "admin") return;
  // Admin-Zeilen sperren, damit parallele Aktionen nicht beide „letzter Admin" verpassen.
  await tx.query("SELECT id FROM users WHERE role = 'admin' FOR UPDATE");
  if ((await countAdmins(tx)) <= 1) {
    throw new ValidationError(
      `Der letzte verbleibende Admin kann nicht ${verb} werden.`,
    );
  }
}
