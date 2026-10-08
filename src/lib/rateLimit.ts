/**
 * 回数制限（2026-10-09 に Upstash へ接続）。
 *
 * - 数えるのは Upstash Redis（東京 / ap-northeast-1）。**インスタンスをまたいで共有される。**
 *   URL とトークンは2通りの名前で読む（`upstashEnv()`）。
 * - 環境変数が無いとき（dev など）は**インスタンスごとのメモリ**で数える。
 * - ★Upstash に繋がらない・応答しないときも**メモリで数える**（fail-open。柴さんの判断）。
 *   止めると応募・面談申込が Upstash の障害で止まるため。そのかわり1リクエストごとに
 *   警告を1行出す（prefix と理由だけ。**鍵＝IP や利用者の ID は出さない**）。
 * - ⚠️ 2026-10-09 まではエラー時に例外がそのまま上がって **500**、応答が無いときは
 *   **5秒待って黙って通す**形だった（ライブラリの既定）。
 * - 確認に使ったキーは有効期限付き（ライブラリが PEXPIRE を付ける）なので片付け不要。
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

/**
 * ★URL とトークンは2通りの名前で読む。Vercel の連携は KV_REST_API_* を入れる。
 * ⚠️ KV_REST_API_READ_ONLY_TOKEN は使わない（読み取り専用では数えられない）。
 */
function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** ★繋がらないときに待つ上限。超えたらメモリで数える（ライブラリの既定5秒は長すぎる） */
const UPSTASH_TIMEOUT_MS = 1000;

async function getUpstash() {
  const env = upstashEnv();
  if (!env) return null;
  if (!upstashRatelimit || !upstashRedis) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    upstashRedis = new Redis({
      url: env.url,
      token: env.token,
      /* ⚠️ 再試行は1回まで。既定の5回だと上限まで待つことが増える */
      retry: { retries: 1 },
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
  /**
   * ★数える単位（2026-10-09 に追加）。渡さなければ従来どおり **IP アドレス**。
   * ⚠️ ログイン必須の API で「利用者ごと」に数えたいときは `auth.users.id` を渡す
   *    （OGP 取得の2本がこれ）。⚠️ 未ログインの経路で渡さないこと（全員が同じ鍵になる）。
   */
  id?: string;
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
  const key = opts.id ? `${opts.prefix}:u:${opts.id}` : `${opts.prefix}:${ip}`;

  const upstash = await getUpstash();

  if (upstash) {
    try {
      const limiter = new upstash.Ratelimit({
        redis: upstash.redis,
        limiter: upstash.Ratelimit.slidingWindow(opts.limit, `${opts.windowSec} s`),
        prefix: "opinio_rl",
        timeout: UPSTASH_TIMEOUT_MS,
      });
      const res = await limiter.limit(key);
      if (res.reason !== "timeout") return res.success;
      console.warn(`[rateLimit] Upstash が応答しないためメモリで数えた prefix=${opts.prefix} reason=timeout`);
    } catch (e) {
      /* ★fail-open。止めると応募・面談申込が Upstash の障害で止まる */
      console.warn(
        `[rateLimit] Upstash に接続できないためメモリで数えた prefix=${opts.prefix} reason=${e instanceof Error ? e.name : "error"}`,
      );
    }
  }

  // In-memory fallback（環境変数が無いとき・Upstash に繋がらないとき）
  return checkInMemory(key, opts.limit, opts.windowSec * 1000);
}
