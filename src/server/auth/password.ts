import bcrypt from "bcryptjs";
import { ValidationError } from "@/server/validation";

export const MIN_PASSWORD_LENGTH = 12;

/** bcrypt liest nur die ersten 72 Byte; alles danach würde stillschweigend ignoriert. */
const MAX_PASSWORD_BYTES = 72;

/** bcrypt-Kostenfaktor für den interaktiven Login (aktuelle Empfehlung). Ein
 *  Ort für echte Hashes und den Dummy-Hash, damit die Zeit-Angleichung stimmt. */
const BCRYPT_COST = 12;

/** Vorberechneter Hash, gegen den bei unbekanntem Nutzer verglichen wird, damit
 *  die Antwortzeit keinen Rückschluss auf existierende Nutzernamen erlaubt. */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "s2-timing-equalizer",
  BCRYPT_COST,
);

/** Gilt überall, wo ein Passwort gesetzt wird; `hashPassword` prüft nicht selbst. */
export function assertPasswordPolicy(password: string, username: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`,
    );
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new ValidationError(
      `Das Passwort darf höchstens ${MAX_PASSWORD_BYTES} Byte lang sein (Umlaute zählen doppelt).`,
    );
  }
  if (password.toLowerCase() === username.toLowerCase()) {
    throw new ValidationError(
      "Das Passwort darf nicht dem Nutzernamen gleichen.",
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
