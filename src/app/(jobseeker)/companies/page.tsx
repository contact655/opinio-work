import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchDistinctLocations, fetchDistinctIndustries, searchCompanies } from "@/lib/search/companies";
import { createClient } from "@/lib/supabase/server";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";
import { RecentlyViewedSection } from "@/components/companies/RecentlyViewedSection";
import { ViewToggle } from "@/components/companies/ViewToggle";
import { GridSortBar } from "@/components/companies/GridSortBar";
import { CompanyCardList } from "@/components/companies/CompanyCardList";
import { CompanyAdminDndOverlay } from "@/components/companies/CompanyAdminDndOverlay";
import { CompareBar } from "@/components/companies/CompareBar";

type MemberPreview = { id: string; name: string };

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

export const metadata: Metadata = {
  title: "IT/SaaS企業を知る — OPINIO",
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の企業の最新求人・組織文化・カジュアル面談情報をまとめて確認。",
  keywords: ["IT企業", "SaaS企業", "カジュアル面談", "スタートアップ", "転職", "企業文化", "OPINIO"],
  alternates: { canonical: "/companies" },
  openGraph: {
    title: "IT/SaaS企業を探す | OPINIO",
    description: "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の企業情報・求人・カジュアル面談をまとめて確認。",
    type: "website",
    url: "/companies",
    images: [{ url: "/api/og?type=list&title=%E4%BC%81%E6%A5%AD%E3%82%92%E6%8E%A2%E3%81%99&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E4%BC%81%E6%A5%AD%E3%83%BB%E3%82%AB%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB%E9%9D%A2%E8%AB%87", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

const PAGE_SIZE = 40;

type SearchParams = {
  q?: string;
  phase?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
  industry?: string;
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
    textDecoration: "none", fontFamily: "Inter, sans-serif",
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
  const { q, phase, workStyle, hiring, location, industry, view, sort } = searchParams;
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const hasFilter = Boolean(q || phase || workStyle || hiring || location || industry);
  // 一覧（4列）= デフォルト（パラメータなし or view=card）
  const isGridView  = !hasFilter && (!view || view === "card");
  // 詳細リスト = view=list
  const isListView  = !hasFilter && view === "list";
  const needsGrid = isGridView || isListView;

  // ── 並列フェッチ（不要なクエリはスキップ）──────────────────────────────────
  const supabase = createClient();

  const [locations, industries, companyNamesResult, allCompaniesResult] = await Promise.all([
    // フィルターバー用ロケーション（キャッシュ済み）
    fetchDistinctLocations(),
    // フィルターバー用業種リスト
    fetchDistinctIndustries(),
    // 検索サジェスト用企業名リスト
    supabase.from("ow_companies").select("id, name").eq("is_published", true).order("name"),
    // グリッド/リスト表示: DB側でページ分だけ取得（総件数も同時取得）
    // #10: sort パラメータをDB側へ渡してサーバーサイドソート
    needsGrid
      ? searchCompanies({ limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE, sort: sort ?? "newest" })
      : Promise.resolve({ companies: [], totalCount: 0, appliedFilters: {} }),
  ]);

  const companySuggestions: { id: string; name: string }[] =
    (companyNamesResult.data ?? []) as { id: string; name: string }[];

  // ── 在籍メンバー取得（表示企業分のみ）─────────────────────────────────────
  const membersByCompany: Record<string, MemberPreview[]> = {};
  if (needsGrid && allCompaniesResult.companies.length > 0) {
    const pageCompanyIds = allCompaniesResult.companies.map((c) => c.id);
    const { data: experienceData } = await supabase
      .from("ow_experiences")
      .select("company_id, user_id, ow_users(id, name)")
      .eq("is_current", true)
      .in("company_id", pageCompanyIds);  // ページ内企業のみ

    if (experienceData) {
      for (const exp of experienceData) {
        const companyId = exp.company_id as string;
        if (!membersByCompany[companyId]) membersByCompany[companyId] = [];
        if (membersByCompany[companyId].length < 8) {
          const user = exp.ow_users as { id: string; name: string } | { id: string; name: string }[] | null;
          if (user) {
            const u = Array.isArray(user) ? user[0] : user;
            if (u) membersByCompany[companyId].push({ id: u.id, name: u.name ?? "?" });
          }
        }
      }
    }
  }


  return (
    <>
    <div style={{ background: "#f0f4f8" }}>
      <h1 className="sr-only">企業を知る</h1>


      {/* ── Search bar panel (sticky) ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", position: "sticky", top: 64, zIndex: 30 }}>
        <div className="max-w-[1440px] mx-auto px-4">
          <Suspense>
            <CompanySearchBar locations={locations} industries={industries} companySuggestions={companySuggestions} />
          </Suspense>
        </div>
      </div>


      <div className="max-w-[1440px] mx-auto px-4 pt-6 pb-8">
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
          />
        ) : (
          <div style={{ marginTop: 0 }}>

            {/* ── メインコンテンツ ── */}
            <div>
              {/* ── View toggle row ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
                <Suspense fallback={null}>
                  <ViewToggle />
                </Suspense>
              </div>

              {isListView || isGridView ? (
                <>
                  {/* #10: sort=jobs の場合はアプリ側で補完ソート（求人数はDB側で計算できないため） */}
                  {(() => {
                    // #10: DB側でソート済み（updated_at DESC for "newest", employee_count DESC for "employees"）
                    // "jobs" のみアプリ側で補完（job_count は集計値のため DB ソート不可）
                    const paged = [...allCompaniesResult.companies];
                    if (sort === "jobs") paged.sort((a, b) => b.job_count - a.job_count);

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
                        <Suspense fallback={null}>
                          <GridSortBar totalCount={allCompaniesResult.totalCount} />
                        </Suspense>
                        {/* 上部ページネーション（2ページ目以降のみ表示） */}
                        {safePage > 1 && (
                          <Pagination currentPage={safePage} totalPages={totalPages} baseHref={baseHref} />
                        )}
                        {isGridView ? (
                          <>
                            <style>{`
                              .companies-grid4 {
                                display: grid;
                                grid-template-columns: repeat(3, 1fr);
                                gap: 16px;
                                margin-top: ${safePage > 1 ? 24 : 0}px;
                              }
                              @media (max-width: 1023px) {
                                .companies-grid4 { grid-template-columns: repeat(2, 1fr); gap: 12px; }
                              }
                              @media (max-width: 600px) {
                                .companies-grid4 { grid-template-columns: 1fr; gap: 10px; }
                              }
                            `}</style>
                            <div className="companies-grid4">
                              {paged.map(c => (
                                <CompanyCardList
                                  key={c.id}
                                  company={c}
                                  members={membersByCompany[c.id] ?? []}
                                  compact
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: safePage > 1 ? 24 : 0 }}>
                            {paged.map(c => (
                              <CompanyCardList
                                key={c.id}
                                company={c}
                                members={membersByCompany[c.id] ?? []}
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

          </div>
        )}

        {/* ── フッターエリア: 最近見た企業 + CTA ── */}
        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>

          {/* 最近見た企業 */}
          {!hasFilter && (
            <Suspense fallback={null}>
              <RecentlyViewedSection />
            </Suspense>
          )}

        </div>{/* フッターエリア end */}

        </div>
      </div>{/* max-w container end */}

    </div>

    {/* 管理者専用: 企業並び替えオーバーレイ（非管理者には何も表示されない） */}
    <CompanyAdminDndOverlay />

    {/* #13: 比較バー（最大3社選択で表示） */}
    <CompareBar />
    </>
  );
}
