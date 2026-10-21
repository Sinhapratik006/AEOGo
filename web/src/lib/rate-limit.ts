import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter stored in Postgres. One atomic upsert per call, so it
 * works across any number of app instances.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const window = Math.max(1, Math.floor(windowSeconds));
  const result = await getDb().execute<{ count: number; retry_after: number }>(sql`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case
        when rate_limits.window_start <= now() - (${window}::int * interval '1 second') then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start <= now() - (${window}::int * interval '1 second') then now()
        else rate_limits.window_start
      end
    returning
      count,
      greatest(1, ceil(extract(epoch from (window_start + (${window}::int * interval '1 second') - now()))))::int as retry_after
  `);
  const row = result.rows[0];
  const count = Number(row?.count ?? 1);
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Number(row?.retry_after ?? window),
  };
}
