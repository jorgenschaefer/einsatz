import type { Db } from "@/server/db/db";
import { createAccount } from "./account-admin";
import { countUsers } from "./users";

/**
 * Stellt beim Erststart genau ein Admin-Konto sicher. Idempotent: sobald
 * irgendein Konto existiert, geschieht nichts – dann braucht es auch keine
 * Zugangsdaten.
 */
export async function seedAdmin(
  db: Db,
  admin: { username?: string; password?: string },
): Promise<void> {
  if ((await countUsers(db)) > 0) return;
  const { username, password } = admin;
  if (!username || !password) {
    throw new Error(
      "ADMIN_USERNAME und ADMIN_PASSWORD müssen gesetzt sein, um den Erst-Admin anzulegen.",
    );
  }
  await createAccount(db, { username, password, role: "admin" });
}
