import { defineConfig } from "drizzle-kit";
import { loadEnv } from "./scripts/load-env";

loadEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
