import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  // Imported after loadEnv() so DATABASE_URL is available.
  const { getDb, closeDb } = await import("../src/db");
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  await migrate(getDb(), { migrationsFolder });
  console.log("[migrate] database is up to date");
  await closeDb();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
