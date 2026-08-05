import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * 投稿してよい人かどうか。
 *
 * ⚠️ 条件はここ1箇所に置く。API のガード（403）と、コンポーザーの表示可否と、
 *    RLS（posts_insert_own）で3つに分かれるので、少なくともアプリ側は揃える。
 *
 * 条件: ow_company_members に行があり is_public = true であること。
 *
 * ⚠️ ow_company_members には CHECK 制約 check_public_requires_consent
 *    (is_public = false OR display_consent = true) がある。
 *    つまり is_public = true は display_consent = true を含意するので、
 *    「面談の可否とは別軸で発信を許可する」ことは現状のスキーマではできない。
 *    別軸にしたいなら ow_company_members に発信用の列を足す必要がある（2026-08-05 時点で未対応）。
 */
export async function canUserPost(
  admin: ReturnType<typeof createAdminClient>,
  owUserId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("ow_company_members")
    .select("id")
    .eq("user_id", owUserId)
    .eq("is_public", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[canUserPost]", error.message);
    return false;   // 判定できないときは投稿させない（安全側）
  }
  return !!data;
}
