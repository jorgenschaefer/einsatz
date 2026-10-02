import { getDb } from "@/server/db/pg";
import { seedAdmin } from "./seed";

async function main() {
  const db = getDb();
  await seedAdmin(db, {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  });
  await db.close();
  console.log("Admin-Konto sichergestellt.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
