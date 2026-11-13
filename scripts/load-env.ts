import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/**
 * Loads env files the same way Next.js does (first file wins), without overriding
 * variables that are already set in the real environment. Used by the worker and
 * CLI scripts, which run outside of Next.js.
 */
export function loadEnv(cwd: string = process.cwd()): void {
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  const files = [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];
  for (const file of files) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const parsed = parseEnv(fs.readFileSync(fullPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined && value !== undefined) {
        process.env[key] = value;
      }
    }
  }
}
