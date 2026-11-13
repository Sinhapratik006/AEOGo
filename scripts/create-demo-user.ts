import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "@/db/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle({ client: pool, schema: { users } });

async function main() {
  // Hash the password
  const password = "demo123";
  const passwordHash = require("node:crypto").createHash("sha256").update(password).digest("hex");

  // Insert a demo user
  const [user] = await db.insert(users).values({
    email: "demo@example.com",
    name: "Demo User",
    passwordHash,
  }).returning();

  console.log("Created demo user:", {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash,
  });

  pool.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});