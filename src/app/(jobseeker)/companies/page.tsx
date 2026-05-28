import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { fetchGenresWithCompanies } from "@/lib/genres";
import { fetchDistinctLocations } from "@/lib/search/companies";
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

type SearchParams = {
  q?: string;
  phase?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
  view?: string;
  sort?: string;
};

type Props = {
  searchParams: SearchParams;
};

export default async function CompaniesPage({ searchParams }: Props) {
  const { q, phase, workStyle, hiring, location, view, sort } = searchParams;
  const hasFilter = Boolean(q || phase || workStyle || hiring || location);
  const isGridView = !hasFilter && view === "grid";
  const isListView = !hasFilter && view === "list";

  // 全データを並列取得（genresWithCompanies は常に取得してヒーロー統計に使う）
  const supabase = createClient();
  const [locations, genresWithCompanies, companyNamesResult] = await Promise.all([
    fetchDistinctLocations(),
    fetchGenresWithCompanies(),
    supabase
      .from("ow_companies")
      .select("id, name")
      .eq("is_published", true)
      .order("name"),
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

  // 統計: ジャンル付き企業数（重複なし）
  const totalCompanies = new Set(genresWithCompanies.flatMap(g => g.companies.map(c => c.id))).size;
  const totalJobs = genresWithCompanies.reduce((acc, g) => acc + g.companies.reduce((a, c) => a + c.job_count, 0), 0);

  return (
    <div style={{ background: "#f0f4f8" }}>
      <h1 className="sr-only">企業を知る</h1>

      {/* ── Page hero header ── */}
      {!hasFilter && (
        <div style={{
          background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
          padding: "28px 0 24px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(59,95,217,0.12)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -40, bottom: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(245,158,11,0.06)", pointerEvents: "none" }} />
          <div className="max-w-[1440px] mx-auto px-4" style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase" }}>
                  COMPANIES
                </div>
                <h1 style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 700,
                  color: "#fff", margin: "0 0 6px", lineHeight: 1.35,
                }}>
                  IT/SaaS業界の企業を知る
                </h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.6 }}>
                  ジャンル・働き方・フェーズで絞り込んで、自分にあった企業を見つけましょう
                </p>
              </div>
              {/* Stats strip */}
              <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,0.08)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden", flexShrink: 0 }}>
                {[
                  { value: String(totalCompanies), unit: "社", label: "掲載企業" },
                  { value: String(totalJobs), unit: "件", label: "公開求人" },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: "12px 20px", textAlign: "center",
                    borderRight: i === 0 ? "1px solid rgba(255,255,255,0.1)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "#fff" }}>{s.value}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B" }}>{s.unit}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
            <Suspense fallback={null}>
              <RecentlyViewedSection />
            </Suspense>

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
                  const allCompanies = Array.from(
                    new Map(
                      genresWithCompanies.flatMap(g => g.companies).map(c => [c.id, c])
                    ).values()
                  );
                  if (sort === "jobs") allCompanies.sort((a, b) => b.job_count - a.job_count);
                  else if (sort === "employees") {
                    allCompanies.sort((a, b) => {
                      const numA = parseInt(String(a.employee_count ?? "0").replace(/\D/g, "")) || 0;
                      const numB = parseInt(String(b.employee_count ?? "0").replace(/\D/g, "")) || 0;
                      return numB - numA;
                    });
                  }
                  return (
                    <>
                      <Suspense fallback={null}>
                        <GridSortBar totalCount={allCompanies.length} />
                      </Suspense>
                      {isGridView ? (
                        <div className="companies-compact-grid">
                          {allCompanies.map(c => (
                            <CompanyCardHoverWrap
                              key={c.id}
                              company={c}
                              members={membersByCompany[c.id] ?? []}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {allCompanies.map(c => (
                            <CompanyCardList
                              key={c.id}
                              company={c}
                              members={membersByCompany[c.id] ?? []}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <GenreTabs genres={genresWithCompanies} />
            )}
          </div>
        )}

        {/* ── 先輩に相談 CTA ── */}
        <div style={{
          marginTop: 48, marginBottom: 16,
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
      </div>
    </div>
  );
}
