import { type Db, isUniqueViolation, type Queryable } from "@/server/db/db";
import { assertUuid, trimmedText, ValidationError } from "@/server/validation";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "./password";
import { type LoginRateLimiter, RATE_LIMITED_MESSAGE } from "./rate-limit";
import { deleteSessionsForUser } from "./sessions";
import {
  countAdmins,
  deleteUser,
  findUserById,
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
  const username = trimmedText(
    input.username,
    "Der Nutzername",
    MAX_USERNAME_LENGTH,
  );
  if (!username)
    throw new ValidationError("Der Nutzername darf nicht leer sein.");
  assertPasswordText(input.password);
  assertPasswordPolicy(input.password, username);
  const passwordHash = await hashPassword(input.password);
  try {
    return await insertUser(db, { username, passwordHash, role: input.role });
  } catch (err) {
    // Eindeutig ohne Rücksicht auf Groß-/Kleinschreibung: users_username_lower_idx.
    if (isUniqueViolation(err)) {
      throw new ValidationError("Dieser Nutzername ist bereits vergeben.");
    }
    throw err;
  }
}

const MAX_USERNAME_LENGTH = 200;

export async function setRole(db: Db, id: string, role: Role): Promise<void> {
  assertUuid(id);
  assertRole(role);
  if (role === "user") {
    await db.transaction(async (tx) => {
      await guardLastAdmin(tx, id, "zum Nutzer degradiert");
      if (!(await updateUserRole(tx, id, role))) throw userNotFound();
    });
    return;
  }
  if (!(await updateUserRole(db, id, role))) throw userNotFound();
}

const userNotFound = () => new ValidationError("Nutzer nicht gefunden.");

/**
 * Setzt das Passwort neu und widerruft alle bestehenden Sessions des Nutzers,
 * damit ein zurückgesetztes Passwort auch offene Anmeldungen beendet.
 */
export async function resetPassword(
  db: Db,
  id: string,
  newPassword: string,
): Promise<void> {
  assertUuid(id);
  assertPasswordText(newPassword);
  const user = await findUserById(db, id);
  if (!user) throw userNotFound();
  assertPasswordPolicy(newPassword, user.username);
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await updateUserPasswordHash(tx, id, passwordHash);
    await deleteSessionsForUser(tx, id);
  });
}

/**
 * Selbst-Passwortänderung: prüft zunächst das aktuelle Passwort, gezählt gegen
 * dasselbe Login-Limit wie die Anmeldung, bevor {@link resetPassword} das neue
 * setzt und alle Sessions widerruft.
 */
export async function changePassword(
  db: Db,
  limiter: LoginRateLimiter,
  ip: string,
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await findUserById(db, id);
  if (!user) throw new ValidationError(WRONG_CURRENT_PASSWORD);
  const attempt = await limiter.attempt(ip, user.username, () =>
    verifyPassword(currentPassword, user.passwordHash),
  );
  if (attempt.status === "rate-limited") {
    throw new ValidationError(RATE_LIMITED_MESSAGE);
  }
  if (!attempt.result) throw new ValidationError(WRONG_CURRENT_PASSWORD);
  await resetPassword(db, id, newPassword);
}

const WRONG_CURRENT_PASSWORD = "Das aktuelle Passwort ist nicht korrekt.";

export async function deleteAccount(db: Db, id: string): Promise<void> {
  assertUuid(id);
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

function assertPasswordText(password: unknown): asserts password is string {
  if (typeof password !== "string") {
    throw new ValidationError("Das Passwort muss Text sein.");
  }
}

function assertRole(role: unknown): asserts role is Role {
  if (role !== "admin" && role !== "user") {
    throw new ValidationError("Unbekannte Rolle.");
  }
}
