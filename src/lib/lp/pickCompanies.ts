import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * LP のピックアップ企業を選ぶ。
 *
 * ── いまの基準（2026-08-05）──────────────────────────────────────────────────
 *   ① 求人 or 記事を1件以上持つ公開企業を updated_at DESC で取る
 *   ② 枠が埋まらなければ、残りの公開企業を updated_at DESC で補う
 *
 * ⚠️ 社員（ow_company_members）は条件に入れていない。
 *    2026-08-05 実測で「求人 or 記事あり」が15社、枠が12なので①だけで埋まっており、
 *    社員条件を足しても顔ぶれが変わらないため。在庫が増えたら見直す。
 *
 * ── カードから「社員」を外した理由（2026-08-05）─────────────────────────────
 * LP のカードは 記事 / 求人 の2項目にしてある。ow_company_members は数えていない。
 *
 *   ① 「社員」というラベルが企業の事実として読まれる。実体は ow_company_members の
 *      自己申告で、企業が在籍確認をしたものではない（2026-08-04 に /people の
 *      ✓バッジを同じ理由で削除している）
 *   ② 数える対象を「経歴を持つ公開メンバー」に変えても数字は変わらない。実測で
 *      ピックアップ12社のうちメンバーがいるのは Salesforce 1社だけ、その1名は
 *      経歴を持っているので 1 のまま
 *   ③ 未ログインでは到達先が鍵になる。実ユーザー5名は全員 ow_users.visibility が
 *      login_only で、企業ページの現役社員は「ログインすると1名のプロフィールが
 *      見られます」に置き換わる。数字を見て飛んでも何も読めない
 *
 * ⚠️ 復活させる条件は2つとも満たすこと。片方だけでは戻さない。
 *      ・メンバーを持つ「公開」企業が十分に増えていること
 *        （2026-08-05 時点では、メンバー4名の所属先3社が is_published=false）
 *      ・未ログインで経歴に到達できるかが整理されていること
 *
 * ⚠️ 並びが updated_at DESC であることに注意。
 *    企業情報を更新するたびに顔ぶれが入れ替わる。「ピックアップ」と言いながら
 *    実体は「最近さわった順」なので、在庫が増えたら安定した基準
 *    （公開日の新着順、あるいは中身の量による注目順）に変えること。
 *    差し替えるのはこの関数だけで済むように切り出してある。
 */

export type PickedCompanyRow = {
  id: string;
  name: string;
  brand_name: string | null;
  industry: string | null;
  phase: string | null;
  logo_url: string | null;
  logo_letter: string | null;
  logo_gradient: string | null;
  url: string | null;
};

const COMPANY_COLS =
  "id, name, brand_name, industry, phase, logo_url, logo_letter, logo_gradient, url";

export async function pickLpCompanies(
  db: ReturnType<typeof createAdminClient>,
  limit: number,
): Promise<PickedCompanyRow[]> {
  // 中身のある企業ID。コンテンツ量に比例する小さな集合なので、
  // 企業数が増えても取得コストは増えない。
  const [jobCoRes, articleCoRes] = await Promise.all([
    db.from("ow_jobs").select("company_id").eq("status", "published").eq("is_test", false),
    db.from("ow_articles").select("company_id").eq("is_published", true).not("company_id", "is", null),
  ]);
  if (jobCoRes.error) console.error("[pickLpCompanies] jobs:", jobCoRes.error.message);
  if (articleCoRes.error) console.error("[pickLpCompanies] articles:", articleCoRes.error.message);

  const withContentIds = Array.from(new Set([
    ...((jobCoRes.data ?? []) as { company_id: string | null }[]).map((r) => r.company_id),
    ...((articleCoRes.data ?? []) as { company_id: string | null }[]).map((r) => r.company_id),
  ].filter(Boolean) as string[]));

  let rows: PickedCompanyRow[] = [];
  if (withContentIds.length > 0) {
    const { data, error } = await db
      .from("ow_companies").select(COMPANY_COLS).eq("is_published", true)
      .in("id", withContentIds).order("updated_at", { ascending: false }).limit(limit);
    if (error) console.error("[pickLpCompanies] picked:", error.message);
    rows = (data ?? []) as unknown as PickedCompanyRow[];
  }

  // 枠が埋まらない場合だけ、更新の新しい企業で補う
  if (rows.length < limit) {
    const exclude = rows.map((c) => c.id);
    let fill = db.from("ow_companies").select(COMPANY_COLS).eq("is_published", true)
      .order("updated_at", { ascending: false }).limit(limit - rows.length);
    if (exclude.length > 0) fill = fill.not("id", "in", `(${exclude.join(",")})`);
    const { data, error } = await fill;
    if (error) console.error("[pickLpCompanies] fill:", error.message);
    rows = [...rows, ...((data ?? []) as unknown as PickedCompanyRow[])];
  }

  return rows;
}
