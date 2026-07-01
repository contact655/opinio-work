/**
 * IP-based rate limiter.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set. Falls back to in-memory (per-instance) when credentials are absent
 * — suitable for dev and single-region deploys; upgrade to Upstash for
 * multi-region production.
 */

import { NextRequest } from "next/server";

// ── In-memory fallback ─────────────────────────────────────────────────────
const ipMap = new Map<string, { count: number; resetAt: number }>();

function checkInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = ipMap.get(key);
  if (!entry || now > entry.resetAt) {
    ipMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── Upstash path ───────────────────────────────────────────────────────────
let upstashRatelimit: typeof import("@upstash/ratelimit").Ratelimit | null = null;
let upstashRedis: InstanceType<typeof import("@upstash/redis").Redis> | null = null;

async function getUpstash() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!upstashRatelimit || !upstashRedis) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    upstashRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    upstashRatelimit = Ratelimit;
  }
  return { Ratelimit: upstashRatelimit, redis: upstashRedis };
}

// ── Public API ─────────────────────────────────────────────────────────────
export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window in seconds */
  windowSec: number;
  /** Identifier prefix (e.g. "apply", "dm") to namespace keys */
  prefix: string;
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Extracts the client IP from x-forwarded-for.
 */
export async function checkRateLimit(
  req: NextRequest,
  opts: RateLimitOptions
): Promise<boolean> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${opts.prefix}:${ip}`;

  const upstash = await getUpstash();

  if (upstash) {
    const limiter = new upstash.Ratelimit({
      redis: upstash.redis,
      limiter: upstash.Ratelimit.slidingWindow(opts.limit, `${opts.windowSec} s`),
      prefix: "opinio_rl",
    });
    const { success } = await limiter.limit(key);
    return success;
  }

  // In-memory fallback
  return checkInMemory(key, opts.limit, opts.windowSec * 1000);
}
