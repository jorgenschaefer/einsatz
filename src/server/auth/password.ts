import bcrypt from "bcryptjs";
import { ValidationError } from "@/server/validation";

export const MIN_PASSWORD_LENGTH = 12;

/** Vorberechneter Hash, gegen den bei unbekanntem Nutzer verglichen wird, damit
 *  die Antwortzeit keinen Rückschluss auf existierende Nutzernamen erlaubt. */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("s2-timing-equalizer", 10);

/** Erzwingt die einzige Passwortregel: mindestens 12 Zeichen. */
export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`,
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
