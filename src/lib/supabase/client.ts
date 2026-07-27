import { createBrowserClient } from "@supabase/ssr";
// Database 型は第2弾で有効化予定。現時点は generic なし
// import type { Database } from "./types";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
