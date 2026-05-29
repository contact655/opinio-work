import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { fetchGenresWithCompanies } from "@/lib/genres";
import { fetchDistinctLocations, searchCompanies } from "@/lib/search/companies";
import { createClient } from "@/lib/supabase/server";
import { GenreTabs } from "@/components/companies/GenreTabs";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";
import { RecentlyViewedSection } from "@/components/companies/RecentlyViewedSection";
import { ViewToggle } from "@/components/companies/ViewToggle";
import { GridSortBar } from "@/components/companies/GridSortBar";
import { CompanyCardHoverWrap } from "@/components/companies/CompanyCardHoverWrap";
import { CompanyCardList } from "@/components/companies/CompanyCardList";

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
  const { q, phase, workStyle, hiring, location, view, sort } = searchParams;
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const hasFilter = Boolean(q || phase || workStyle || hiring || location);
  const isGridView = !hasFilter && (view === "grid" || !view);
  const isListView = !hasFilter && view === "list";

  // 全データを並列取得
  const supabase = createClient();
  const [locations, genresWithCompanies, companyNamesResult, allCompaniesResult] = await Promise.all([
    fetchDistinctLocations(),
    fetchGenresWithCompanies(),
    supabase
      .from("ow_companies")
      .select("id, name")
      .eq("is_published", true)
      .order("name"),
    // コンパクト/リスト表示用: ジャンル紐付けに依存せず全公開企業を取得
    (isGridView || isListView) ? searchCompanies({}) : Promise.resolve({ companies: [], totalCount: 0, appliedFilters: {} }),
  ]);

  const companySuggestions: { id: string; name: string }[] =
    (companyNamesResult.data ?? []) as { id: string; name: string }[];

  // Fetch current employees for grid/list views
  const membersByCompany: Record<string, MemberPreview[]> = {};
  if (isGridView || isListView) {
    const { data: experienceData } = await supabase
      .from("ow_experiences")
      .select("company_id, user_id, ow_users(id, name)")
      .eq("is_current", true)
      .not("company_id", "is", null)
      .limit(300);

    if (experienceData) {
      for (const exp of experienceData) {
        const companyId = exp.company_id as string;
        if (!membersByCompany[companyId]) membersByCompany[companyId] = [];
        if (membersByCompany[companyId].length < 8) {
          const user = exp.ow_users as { id: string; name: string } | { id: string; name: string }[] | null;
          if (user) {
            const u = Array.isArray(user) ? user[0] : user;
            if (u) {
              membersByCompany[companyId].push({
                id: u.id,
                name: u.name ?? "?",
              });
            }
          }
        }
      }
    }
  }


  return (
    <div style={{ background: "#f0f4f8" }}>
      <h1 className="sr-only">企業を知る</h1>


      {/* ── Search bar panel (sticky) ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", position: "sticky", top: 64, zIndex: 30 }}>
        <div className="max-w-[1440px] mx-auto px-4">
          <Suspense>
            <CompanySearchBar locations={locations} companySuggestions={companySuggestions} />
          </Suspense>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 pt-6 pb-8">

        {/* フィルタ適用中: 検索結果グリッド / 非適用: ジャンルカルーセル or コンパクトグリッド */}
        {hasFilter ? (
          <CompanySearchResults
            q={q}
            phase={phase}
            workStyle={workStyle}
            hiring={hiring}
            location={location}
          />
        ) : (
          <div style={{ marginTop: 16 }}>

            {/* ── メインコンテンツ ── */}
            <div>
              {/* ── View toggle row ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
                <Suspense fallback={null}>
                  <ViewToggle />
                </Suspense>
              </div>

              {isGridView || isListView ? (
                <>
                  {isGridView && (
                    <style>{`
                      .companies-compact-grid {
                        display: grid;
                        grid-template-columns: repeat(5, 1fr);
                        gap: 14px;
                      }
                      @media (max-width: 1279px) {
                        .companies-compact-grid { grid-template-columns: repeat(4, 1fr); }
                      }
                      @media (max-width: 1023px) {
                        .companies-compact-grid { grid-template-columns: repeat(3, 1fr); }
                      }
                      @media (max-width: 639px) {
                        .companies-compact-grid { grid-template-columns: repeat(2, 1fr); }
                      }
                    `}</style>
                  )}
                  {(() => {
                    const allCompanies = [...allCompaniesResult.companies];
                    if (sort === "jobs") allCompanies.sort((a, b) => b.job_count - a.job_count);
                    else if (sort === "employees") {
                      allCompanies.sort((a, b) => {
                        const numA = parseInt(String(a.employee_count ?? "0").replace(/\D/g, "")) || 0;
                        const numB = parseInt(String(b.employee_count ?? "0").replace(/\D/g, "")) || 0;
                        return numB - numA;
                      });
                    }

                    // ── ページネーション ──
                    const totalPages = Math.max(1, Math.ceil(allCompanies.length / PAGE_SIZE));
                    const safePage = Math.min(currentPage, totalPages);
                    const paged = allCompanies.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

                    // ページネーション用ベースURL（page= を除いたクエリ）
                    const baseParams = new URLSearchParams();
                    if (view) baseParams.set("view", view);
                    if (sort) baseParams.set("sort", sort);
                    const baseHref = `/companies${baseParams.toString() ? `?${baseParams.toString()}` : ""}`;

                    return (
                      <>
                        <Suspense fallback={null}>
                          <GridSortBar totalCount={allCompanies.length} />
                        </Suspense>
                        {/* 上部ページネーション（2ページ目以降のみ表示） */}
                        {safePage > 1 && (
                          <Pagination currentPage={safePage} totalPages={totalPages} baseHref={baseHref} />
                        )}
                        {isGridView ? (
                          <div className="companies-compact-grid" style={{ marginTop: safePage > 1 ? 24 : 0 }}>
                            {paged.map(c => (
                              <CompanyCardHoverWrap
                                key={c.id}
                                company={c}
                                members={membersByCompany[c.id] ?? []}
                              />
                            ))}
                          </div>
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
                        {/* 下部ページネーション（常に表示） */}
                        <Pagination currentPage={safePage} totalPages={totalPages} baseHref={baseHref} />
                      </>
                    );
                  })()}
                </>
              ) : (
                <GenreTabs genres={genresWithCompanies} />
              )}
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

          {/* ── 先輩に相談 CTA ── */}
          <div style={{
            padding: "32px 36px",
            background: "var(--royal-50)",
            border: "1.5px solid var(--royal-100)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: 8, textTransform: "uppercase" as const }}>
              OPINIO MENTOR
            </div>
            <p style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 500,
              color: "var(--ink)", margin: 0, lineHeight: 1.55,
            }}>
              企業を絞り込んだら、その会社の先輩に話を聞いてみよう。
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.7 }}>
              OPINIOのメンターは編集部が個別に声がけした現役・元社員のみ。30分・完全無料で相談できます。
            </p>
          </div>
          <Link href="/mentors" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700,
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            color: "#fff", textDecoration: "none",
            boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            先輩に相談する（無料）
          </Link>
          </div>

        </div>{/* フッターエリア end */}
      </div>
    </div>
  );
}
