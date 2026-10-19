import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★フィードを見ている人が検証用アカウントか（2026-10-20）。`isPostVisibleTo` の第3引数に渡す。
 *
 * 検証用アカウント（is_test）の投稿を実在の利用者のフィードに出さないため。
 * 2026-10-20 時点で利用者の投稿は1件だけで、それが検証用の「aaaaaaa」だった
 * （実在の利用者がログインすると、ホームの一番上に出ていた）。
 *
 * ⚠️ admin クライアントで引く。`ow_users.is_test` は authenticated に SELECT を配っていない。
 * ⚠️ 未ログイン・取得失敗は false（＝実在の利用者として扱い、検証用の投稿を出さない側に倒す）。
 */
export async function viewerIsTestByAuthId(authId: string | null | undefined): Promise<boolean> {
  if (!authId) return false;
  const { data, error } = await createAdminClient()
    .from("ow_users").select("is_test").eq("auth_id", authId).maybeSingle();
  if (error) console.error("[feed] viewer is_test:", error.message);
  return data?.is_test === true;
}
