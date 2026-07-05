import type { Db } from "@/server/db/db";
import { hashPassword } from "./password";
import { countUsers, insertUser } from "./users";

/**
 * Stellt beim Erststart genau ein Admin-Konto sicher. Idempotent: sobald
 * irgendein Konto existiert, geschieht nichts.
 */
export async function seedAdmin(
  db: Db,
  admin: { username: string; password: string },
): Promise<void> {
  if ((await countUsers(db)) > 0) return;
  const passwordHash = await hashPassword(admin.password);
  await insertUser(db, {
    username: admin.username,
    passwordHash,
    role: "admin",
  });
}
