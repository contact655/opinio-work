/**
 * Public Supabase client — 認証不要の公開データ取得専用
 *
 * cookies() を呼ばないため Next.js の ISR/fetch キャッシュが有効になる。
 * ow_companies / ow_jobs / ow_mentors / ow_articles など
 * RLS で anon ロールに SELECT 権限がある公開テーブルに使用する。
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
