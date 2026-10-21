import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

// Cached on globalThis so Next.js dev-mode hot reloads don't open a new pool each time.
const globalForDb = globalThis as unknown as {
  __aeogoPool?: Pool;
  __aeogoDb?: Database;
};

export function getPool(): Pool {
  if (!globalForDb.__aeogoPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres database.",
      );
    }
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => {
      console.error("[db] idle client error", err);
    });
    globalForDb.__aeogoPool = pool;
  }
  return globalForDb.__aeogoPool;
}

export function getDb(): Database {
  if (!globalForDb.__aeogoDb) {
    globalForDb.__aeogoDb = drizzle({ client: getPool(), schema });
  }
  return globalForDb.__aeogoDb;
}

export async function closeDb(): Promise<void> {
  const pool = globalForDb.__aeogoPool;
  globalForDb.__aeogoPool = undefined;
  globalForDb.__aeogoDb = undefined;
  if (pool) await pool.end();
}
