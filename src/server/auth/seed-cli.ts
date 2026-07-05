import { getDb } from "@/server/db/pg";
import { seedAdmin } from "./seed";

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("ADMIN_USERNAME und ADMIN_PASSWORD müssen gesetzt sein.");
  }
  const db = getDb();
  await seedAdmin(db, { username, password });
  await db.close();
  console.log("Admin-Konto sichergestellt.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
