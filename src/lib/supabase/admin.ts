import { createClient } from "@supabase/supabase-js";
// Database 型は第2弾で有効化予定。現時点は generic なし
// import type { Database } from "./types";

/**
 * サーバーサイド専用の管理クライアント（RLSをバイパス）
 * API Route内でのみ使用すること。クライアントサイドでは絶対に使わない。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
