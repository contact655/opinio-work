import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchAvailablePhases, fetchDistinctLocations, searchCompanies } from "@/lib/search/companies";
import { fetchCompanySuggestions } from "@/lib/search/companies";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";
import { RecentlyViewedSection } from "@/components/companies/RecentlyViewedSection";
import { GridSortBar } from "@/components/companies/GridSortBar";
import { CompanyCardList } from "@/components/companies/CompanyCardList";
import { CompanyAdminDndOverlay } from "@/components/companies/CompanyAdminDndOverlay";
import { featuredCompanyPrefix } from "@/lib/seo/featuredCompanies";
import { getBusinessDomainFacets } from "@/lib/companies/businessDomainsCached";


// 企業名はベタ書きしない（理由は lib/seo/featuredCompanies.ts のコメント参照）。
// 一覧ページなので基準は "content"＝求人と記事の合計が多い順。
export async function generateMetadata(): Promise<Metadata> {
  const lead = await featuredCompanyPrefix("content");
  const description = `${lead}IT/SaaS業界の企業情報・求人・組織文化をまとめて確認できます。`;

  return {
    title: { absolute: "IT/SaaS企業を知る | OPINIO" },
    description,
    keywords: ["IT企業", "SaaS企業", "スタートアップ", "転職", "企業文化", "求人", "OPINIO"],
    alternates: { canonical: "/companies" },
    openGraph: {
      title: "IT/SaaS企業を探す | OPINIO",
      description,
      type: "website",
      url: "/companies",
      // OG画像の sub も「企業・求人」に合わせる（旧: 企業・カジュアル面談）
      images: [{ url: "/api/og?type=list&name=%E4%BC%81%E6%A5%AD%E3%82%92%E6%8E%A2%E3%81%99&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E4%BC%81%E6%A5%AD%E3%83%BB%E6%B1%82%E4%BA%BA&v=2", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", description },
  };
}

const PAGE_SIZE = 40;

type SearchParams = {
  q?: string;
  phase?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
  industry?: string;
  foreign?: string;
  view?: string;
  sort?: string;
  page?: string;
};

type Props = {
  searchParams: SearchParams;
};

// ── ページネーション (Link ベース) ──────────────────────────────────────────────
function Pagination({
  currentPage,
  totalPages,
  baseHref,
}: {
  currentPage: number;
  totalPages: number;
  baseHref: string; // "?view=grid&sort=jobs" など（page= を除いたクエリ文字列）
}) {
  if (totalPages <= 1) return null;

  const items: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
  } else {
    items.push(1);
    if (currentPage > 3) items.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      items.push(i);
    }
    if (currentPage < totalPages - 2) items.push("ellipsis");
    items.push(totalPages);
  }

  const sep = baseHref.includes("?") ? "&" : "?";
  const href = (p: number) => `${baseHref}${sep}page=${p}`;

  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 36, height: 36, padding: "0 10px", borderRadius: 8,
    border: "1px solid var(--line)", background: "#fff",
    color: "var(--ink-soft)", fontSize: 13, fontWeight: 500,
    textDecoration: "none", fontFamily: "var(--font-inter), var(--font-noto)",
  };
  const active: React.CSSProperties = { ...base, background: "var(--royal)", borderColor: "var(--royal)", color: "#fff" };
  const disabled: React.CSSProperties = { ...base, opacity: 0.4, cursor: "not-allowed" };

  return (
    <nav aria-label="ページネーション" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32, flexWrap: "wrap" }}>
      {currentPage > 1
        ? <a href={href(currentPage - 1)} style={{ ...base, minWidth: 72 }}>← 前へ</a>
        : <span style={{ ...disabled, minWidth: 72 }}>← 前へ</span>}
      {items.map((item, idx) =>
        item === "ellipsis"
          ? <span key={`e-${idx}`} style={{ color: "var(--ink-mute)", padding: "0 4px", fontSize: 13 }}>…</span>
          : <a key={item} href={href(item)} style={item === currentPage ? active : base} aria-current={item === currentPage ? "page" : undefined}>{item}</a>
      )}
      {currentPage < totalPages
        ? <a href={href(currentPage + 1)} style={{ ...base, minWidth: 72 }}>次へ →</a>
        : <span style={{ ...disabled, minWidth: 72 }}>次へ →</span>}
    </nav>
  );
}

export default async function CompaniesPage({ searchParams }: Props) {
  const { q, phase, workStyle, hiring, location, industry, foreign, view, sort } = searchParams;
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  // foreign は並び替えモディファイア扱いのため hasFilter に含めない（ソートバーを維持するため）
  const hasFilter = Boolean(q || phase || workStyle || hiring || location || industry);
  /* 詳細リスト = view=list。★**これだけを名指しで判定する。** */
  const isListView  = !hasFilter && view === "list";
  /* 一覧（グリッド）= 既定。★**未知の値もここに落とす**（2026-08-28）。
     ⚠️ それまでは `!view || view === "card"` だったため、`?view=grid` のような
        **綴り違いで isGridView も isListView も false になり、needsGrid が false**。
        検索も一覧も描かれない**空ページ（実測 81KB）が 200 で返っていた**。
     ⚠️ 並び替えの `sort` が未知の値を既定に落としているのと同じ流儀
        （GridSortBar のコメント。`?sort=jobs` / `?sort=salary` の前例）。 */
  const isGridView  = !hasFilter && !isListView;
  const needsGrid = isGridView || isListView;

  /* ── 全クエリを並列実行 ──────────────────────────────────────────────────
     ★2026-08-23 に**直列の2段目を無くした**。それまでは「表示中の企業IDが
       確定してから在籍メンバーを引く」形で、1往復ぶん余計に待っていた。 */
  const [locations, phaseOptions, industryFacets, companySuggestions, allCompaniesResult] = await Promise.all([
    // フィルターバー用ロケーション（unstable_cache 300s）
    fetchDistinctLocations(),
    fetchAvailablePhases(),
    /* 事業領域の選択肢（unstable_cache 300s）。⚠️ **掲載中が1社以上あるものだけ。**
          フェーズと同じ扱いで、0件の選択肢を出さない。 */
    getBusinessDomainFacets(),
    // 検索サジェスト用企業名リスト（unstable_cache 300s）
    fetchCompanySuggestions(),
    // グリッド/リスト: DB側ページネーション + count を1クエリで取得
    needsGrid
      ? searchCompanies({
          limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE,
          sort: sort ?? "newest", foreign: foreign === "1",
        })
      : Promise.resolve({ companies: [], totalCount: 0, appliedFilters: {} }),
    // 口コミ平均スコア
  ]);

  return (
    <>
    <div style={{ background: "#f0f4f8" }}>
      <h1 className="sr-only">企業を知る</h1>


      {/* ── Search bar panel (sticky) ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", position: "sticky", top: 60, zIndex: 30 }}>
        <div className="max-w-[1440px] mx-auto px-4">
          <Suspense>
            <CompanySearchBar locations={locations} phaseOptions={phaseOptions} industryOptions={industryFacets} companySuggestions={companySuggestions} />
          </Suspense>
        </div>
      </div>
    </div>

    {/* ── 並び替えバー（白ゾーン、フィルター非適用時のみ） ── */}
    {!hasFilter && needsGrid && (
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-[1440px] mx-auto px-4 py-3">
          <Suspense fallback={null}>
            <GridSortBar totalCount={allCompaniesResult.totalCount} />
          </Suspense>
        </div>
      </div>
    )}

    <div style={{ background: "#f0f4f8" }}>
      <div className="max-w-[1440px] mx-auto px-4 pt-4 pb-8">
        <div>

        {/* フィルタ適用中: 検索結果グリッド / 非適用: ジャンルカルーセル or コンパクトグリッド */}
        {hasFilter ? (
          <CompanySearchResults
            q={q}
            phase={phase}
            workStyle={workStyle}
            hiring={hiring}
            location={location}
            industry={industry}
            foreign={foreign}
          />
        ) : (
          <div style={{ marginTop: 0 }}>

            {/* ── メインコンテンツ ── */}
            <div>
              {isListView || isGridView ? (
                <>
                  {(() => {
                    // DB側でソート済み（updated_at DESC for "newest", employee_count DESC for "employees"）
                    /* ⚠️ "jobs"（募集中あり優先）は 2026-08-18 に廃止した。
                          「募集あり」フィルタと同じ用途で、入口が2つあった（ルール⑧）。 */
                    /* ★並び替えは**すべて `searchCompanies`（DB と lib/search/companies.ts）で完結する。**
                          ここで再ソートしない。

                       ── ⚠️★ここにあった2つの再ソートは 2026-08-28 に削除した ──────────
                       ① `sort === "disclosure"` … `reality_disclosure` の有無で並べ替えていた。
                          実測: **掲載79社すべてが `{}`（空の jsonb）** で入力UIも無い。
                          ⚠️ 「null だから false」ではない。**`{}` は JS では truthy** なので、
                             この列に値が入り始めた日に**本物の開示スコアを上書きする**
                             （`lib/search/companies.ts` の `disclosureScore` が正）。
                       ② `sort === "startup"` … **UI に選択肢が無い**（`GridSortBar` の
                          `SORT_OPTIONS` は newest / employees / disclosure の3つだけ）。
                          `funding_stage` が入っているのは 6社だけで、値も `listed` / `seed` の2種類。

                       ⚠️★**どちらも `paged`（＝現在ページの12件）しか並べ替えていなかった。**
                          2ページ目以降の企業は絶対に上がってこない**部分ソート**で、
                          「全体を並べ替えた」ように見えるのが一番まずい形だった。

                       ⚠️ 再ソートを足したくなったら、**`searchCompanies` 側に足すこと。**
                          ページングの後ろで並べ替えると必ずこの問題が出る。
                       ⚠️ 旧 URL の `?sort=startup` は既定（新着順）に落ちる。壊れない
                          （`?sort=jobs` / `?sort=salary` を外したときと同じ）。 */
                    const paged = allCompaniesResult.companies;

                    // totalCount は DB の COUNT クエリから取得済み
                    const totalPages = Math.max(1, Math.ceil(allCompaniesResult.totalCount / PAGE_SIZE));
                    const safePage   = Math.min(currentPage, totalPages);

                    // ページネーション用ベースURL（page= を除いたクエリ）
                    const baseParams = new URLSearchParams();
                    if (view) baseParams.set("view", view);
                    if (sort) baseParams.set("sort", sort);
                    const baseHref = `/companies${baseParams.toString() ? `?${baseParams.toString()}` : ""}`;

                    return (
                      <>
                        {isGridView ? (
                          <>
                            <style>{`
                              .companies-grid4 {
                                display: grid;
                                grid-template-columns: repeat(3, 1fr);
                                gap: 16px;
                                margin-top: 0px;
                              }
                              @media (max-width: 1199px) {
                                .companies-grid4 { grid-template-columns: repeat(2, 1fr); gap: 14px; }
                              }
                              @media (max-width: 600px) {
                                .companies-grid4 { grid-template-columns: repeat(1, 1fr); gap: 8px; }
                              }
                            `}</style>
                            <div className="companies-grid4">
                              {paged.map(c => (
                                <CompanyCardList
                                  key={c.id}
                                  company={c}
                                  compact
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 0 }}>
                            {paged.map(c => (
                              <CompanyCardList
                                key={c.id}
                                company={c}
                              />
                            ))}
                          </div>
                        )}
                        {/* 下部ページネーション */}
                        <Pagination currentPage={safePage} totalPages={totalPages} baseHref={baseHref} />
                      </>
                    );
                  })()}
                </>
              ) : null}
            </div>

            {/* 最近見た企業（一覧下部） */}
            <Suspense fallback={null}>
              <RecentlyViewedSection />
            </Suspense>

          </div>
        )}

        <div style={{ marginBottom: 16 }} />

        </div>
      </div>{/* max-w container end */}

    </div>

    {/* 管理者専用: 企業並び替えオーバーレイ（非管理者には何も表示されない） */}
    <CompanyAdminDndOverlay />

    </>
  );
}
