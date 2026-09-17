import { getCompanyBySlugOrId, getCompanyTargetIndustriesCached } from "@/lib/supabase/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyPane } from "@/components/companies/CompanyPane";

/*
 * 右ペインの1社ぶんを取ってくる（2026-09-18）。
 *
 * ⚠️★**`Suspense` の中で使うための部品。** ページ側で await すると、
 *    新しい RSC が届くまで**前の企業の内容が出たまま残る**。
 *    ⚠️ ページ先頭に await を戻さないこと（スケルトンが出せなくなる）。
 *
 * ⚠️ 追加のクエリは**記事の1本だけ**。概要・企業情報・求人・事業/製品は `detail` に
 *    既に入っており、社員はクライアント（`useCompanyEmployees`）が取る。
 *
 * ⚠️ 読み上げ（`aria-live`）もここで出す。ページ側の骨組みで出すと、
 *    **中身より先に新しい社名を読み上げる**ことになる。
 */
export async function CompanyPaneLoader({ slugOrId }: { slugOrId: string }) {
  const result = await getCompanyBySlugOrId(slugOrId);
  /* ⚠️ 見つからないときは何も出さない。「該当なし」の箱を出すと、
        URL を直接叩いた人に**一覧とペインで食い違う**画面を見せることになる。 */
  if (!result) return null;

  const [targets, articles] = await Promise.all([
    getCompanyTargetIndustriesCached(result.resolvedId),
    (async () => {
      const db = createAdminClient();
      const { data, error } = await db
        .from("ow_articles")
        .select("id, slug, title")
        .eq("company_id", result.resolvedId)
        .order("published_at", { ascending: false })
        .limit(5);
      /* ⚠️ error を捨てない。権限や列名の間違いが「0件」に化ける（CLAUDE.md） */
      if (error) console.error("[CompanyPaneLoader] ow_articles:", error.message);
      return (data ?? []).map((a) => ({
        id: a.id as string,
        title: a.title as string,
        href: `/articles/${a.slug ?? a.id}`,
        kind: "article",
      }));
    })(),
  ]);

  return (
    <>
      {/* ⚠️ 正式名称をそのまま読み上げる（`companyDisplayName` の省略形だと
             「Salesforce」のように英名だけになり、聞いただけでは同定しにくい） */}
      <span className="sr-only" aria-live="polite">{result.company.name} の概要を表示しました</span>
      <CompanyPane
        company={result.company}
        detail={result.detail}
        targetIndustries={targets}
        activity={articles}
      />
    </>
  );
}

export default CompanyPaneLoader;
