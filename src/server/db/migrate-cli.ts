import { migrate } from "./migrations";
import { getDb } from "./pg";

async function main() {
  const db = getDb();
  await migrate(db);
  await db.close();
  console.log("Migrationen angewandt.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
