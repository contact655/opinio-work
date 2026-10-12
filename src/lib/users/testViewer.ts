import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★見ている人が検証用アカウント（ow_users.is_test）か（2026-10-12）。未ログイン・取れないときは false。
 * ⚠️ 判定はサーバーだけ。クッキーや URL の値を信じない。
 * ⚠️ ISR のページ（/companies/[id]・/jobs/[id]）から呼ばないこと（認証を読むとページ全体が動的になる）。
 *    検証用の会社は /t/companies・/t/jobs（動的・noindex）で出す。
 */
export const viewerIsTestUser = cache(async (): Promise<boolean> => {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return false;
  const { data, error } = await createAdminClient().from("ow_users").select("is_test").eq("auth_id", user.id).maybeSingle();
  if (error) { console.error("[viewerIsTestUser]", error.message); return false; }
  return data?.is_test === true;
});
