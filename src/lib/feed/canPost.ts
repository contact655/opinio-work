import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * 投稿してよい人かどうか。
 *
 * ⚠️ 条件はここ1箇所に置く。API のガード（403）と、コンポーザーの表示可否と、
 *    RLS（posts_insert_own）で3つに分かれるので、少なくともアプリ側は揃える。
 *
 * 条件: ow_company_members に行があること。**それだけ**。
 *
 * ⚠️ is_public / display_consent は条件に含めない（2026-08-05 に is_public から変更）。
 *    ow_company_members には CHECK 制約 check_public_requires_consent
 *    (is_public = false OR display_consent = true) があり、is_public は
 *    display_consent を含意する。そのため is_public でゲートすると、
 *    「面談に同意した人だけが発信できる」ことになってしまう。
 *    投稿は本人の能動的な行為であって、掲載同意で守る対象ではない。
 *    結果として is_public = false のメンバー（招待済み・未同意）も投稿できる。これは許容。
 */
export async function canUserPost(
  admin: ReturnType<typeof createAdminClient>,
  owUserId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("ow_company_members")
    .select("id")
    .eq("user_id", owUserId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[canUserPost]", error.message);
    return false;   // 判定できないときは投稿させない（安全側）
  }
  return !!data;
}
