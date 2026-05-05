import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * auth.users.id (auth_id) から ow_users.id を解決する。
 *
 * - Supabase auth でログインしているユーザーの auth.uid() を、
 *   アプリケーション側のユーザー ID(ow_users.id)に変換する。
 * - ow_users にレコードが存在しない場合は null を返す。
 *
 * @param supabase Supabase クライアント
 * @param authUid auth.users.id の値(通常は user.id)
 * @returns ow_users.id または null
 *
 * @remarks
 * 既存の 4 つの API ファイル(casual-meetings, mentor-reservations,
 * bookmarks, jobseeker/experiences)にも類似のロジックがインラインで
 * 存在する。Phase η 前のリファクタで統一を予定。
 *
 * 本関数は jobseeker/experiences と同じシグネチャを採用している。
 * applications で auth.getUser() の戻り値(user.user_metadata,
 * user.email など)を別途使う必要があるため、auth.getUser() の呼び出しは
 * 関数の外で行う方が自然なため。
 */
export async function resolveOwUserId(
  supabase: SupabaseClient,
  authUid: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  return data?.id ?? null;
}
