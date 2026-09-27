import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 企業を「誰が作ったか」を `ow_company_creations` に記録する。
 *
 * ── なぜ要るか（2026-09-28）────────────────────────────────────────────────
 * **検証用アカウントが作った企業行を見つける手段が、片方の入口に無かった。**
 * `/biz` 経由（`source='biz_self'`）は `ow_company_admins` の行から辿れるが、
 * **オンボーディング経由（`source='user'`）はどこにも記録が無かった。**
 * その結果、CLAUDE.md の取り残し検査SQL（`ow_company_admins` を join する）は
 * `source='user'` の企業を**構造上ヒットさせられず**、
 * 2026-09-28 に本番で作られた「株式会社テスト」を 0件 と報告していた。
 *
 * ⚠️★**2経路とも必ずここを通すこと。** 条件や INSERT を呼び出し側に書き写さない。
 *    企業を作る経路を新しく足すときも、作成直後にこれを呼ぶ。
 *
 * ⚠️★**`ow_companies` に列を足す形に戻さないこと。** あの表の SELECT は
 *    anon にテーブルレベル（実測 2026-09-28: 153/153列）なので、
 *    `is_published = true` の企業について作成者が誰にでも読める。
 *    ⚠️ 既存の `ow_companies.user_id` も使わない ——`auth.uid() = user_id` の
 *       RLS が掛かっており、書いた瞬間にその利用者へ企業の閲覧・編集権を渡す。
 *
 * ⚠️ **best-effort。** 失敗しても企業の作成は止めない（記録のために作成を失敗させない）。
 *    ただし握り潰さず `console.error` に出す。
 */
export async function recordCompanyCreation(
  companyId: string,
  /** ⚠️★**`ow_users.id` の空間**（`auth.uid()` ではない）。
   *  解決できなかったときは null を渡す。**「不明」を埋めるより、null のほうが正しい。 */
  createdByOwUserId: string | null,
): Promise<void> {
  const admin = createAdminClient();
  /* ⚠️ `upsert` にするのは、同じ企業について2回呼ばれても壊れないようにするため
        （company_id が主キー）。2回目は作成者を上書きしない方が自然なので、
        ⚠️ **既に行があるときは何もしない**（`ignoreDuplicates`）。 */
  const { error } = await admin
    .from("ow_company_creations")
    .upsert(
      { company_id: companyId, created_by_ow_user_id: createdByOwUserId },
      { onConflict: "company_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[recordCompanyCreation] 記録に失敗:", companyId, error.message);
  }
}
