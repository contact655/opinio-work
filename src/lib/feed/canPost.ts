import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * 投稿してよい人かどうか。
 *
 * ⚠️ 条件はここ1箇所に置く。API のガード（403）と、コンポーザーの表示可否と、
 *    RLS（posts_insert_own）で3つに分かれるので、少なくともアプリ側は揃える。
 *
 * 条件: ow_company_members に行があること。**ただし未承認の本人申請は数えない**（下記）。
 *
 * ⚠️ is_public / display_consent は条件に含めない（2026-08-05 に is_public から変更）。
 *    ow_company_members には CHECK 制約 check_public_requires_consent
 *    (is_public = false OR display_consent = true) があり、is_public は
 *    display_consent を含意する。そのため is_public でゲートすると、
 *    「面談に同意した人だけが発信できる」ことになってしまう。
 *    投稿は本人の能動的な行為であって、掲載同意で守る対象ではない。
 *    結果として is_public = false のメンバー（招待済み・未同意）も投稿できる。これは許容。
 *
 * ⚠️★上の判断は**そのまま生きている**。2026-08-23 に足したのは別の軸（2026-08-23）。
 *    本人がマイページから申請できるようにしたため（`created_via = 'self'`）、
 *    **在籍がまだ企業に確認されていない行**が存在しうるようになった。
 *    `ow_experiences` の在籍は自己申告なので、そのままだと「セールスフォース在籍」と
 *    書くだけで投稿権限が付いてしまう。
 *    そこで **`created_via='self'` かつ `is_public=false` のあいだだけ数えない**。
 *    ⚠️ 掲載同意（display_consent）では切っていない。切ると 2026-08-05 の判断を覆すことになる。
 *
 * ⚠️ 既存行は `created_via` が NULL なので**この条件に当たらない**。
 *    招待済み・未同意の人は今までどおり投稿できる（実測で6人とも変化なしを確認）。
 *
 * ⚠️★**RLS（posts_insert_own）と同じ式にすること。** 片方だけ直すと
 *    PostgREST を直接叩いて抜けられる。DB 側は 20260823040000 で同じ条件に揃えてある。
 */
export async function canUserPost(
  admin: ReturnType<typeof createAdminClient>,
  owUserId: string,
): Promise<boolean> {
  /* ⚠️ PostgREST の `.neq()` で絞らないこと。`created_via` が NULL の行は
        NULL 比較が真にならず**落ちてしまう**（既存メンバー全員が投稿できなくなる）。
        件数は1人あたり数行なので、取ってから JS で判定する。 */
  const { data, error } = await admin
    .from("ow_company_members")
    .select("id, created_via, is_public")
    .eq("user_id", owUserId);
  if (error) {
    console.error("[canUserPost]", error.message);
    return false;   // 判定できないときは投稿させない（安全側）
  }
  // RLS の `not (coalesce(created_via,'') = 'self' and is_public = false)` と同じ
  return (data ?? []).some((m) => !(m.created_via === "self" && m.is_public === false));
}
