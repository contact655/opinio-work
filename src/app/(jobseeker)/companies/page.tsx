import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { fetchGenresWithCompanies } from "@/lib/genres";
import { fetchDistinctIndustries, fetchDistinctLocations } from "@/lib/search/companies";
import { createClient } from "@/lib/supabase/server";
import { GenreSection } from "@/components/companies/GenreSection";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";

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
  industry?: string;
  size?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
};

type Props = {
  searchParams: SearchParams;
};

export default async function CompaniesPage({ searchParams }: Props) {
  const { q, industry, size, workStyle, hiring, location } = searchParams;
  const hasFilter = Boolean(q || industry || size || workStyle || hiring || location);

  // 全データを並列取得（genresWithCompanies は常に取得してヒーロー統計に使う）
  const supabase = createClient();
  const [industries, locations, genresWithCompanies, casualResult] = await Promise.all([
    fetchDistinctIndustries(),
    fetchDistinctLocations(),
    fetchGenresWithCompanies(),
    supabase
      .from("ow_companies")
      .select("id", { count: "exact", head: true })
      .eq("accepting_casual_meetings", true)
      .eq("is_published", true),
  ]);

  const totalCount = genresWithCompanies.reduce((s, g) => s + g.total_count, 0);
  const casualCount = casualResult.count ?? totalCount;

  return (
    <div style={{ background: "#f0f4f8" }}>
      {/* ── Gradient hero header ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, var(--royal) 55%, #1e3a8a 100%)",
        padding: "36px 0 32px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background decorations */}
        <div style={{ position: "absolute", right: -100, top: -100, width: 480, height: 480, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -60, bottom: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.025)", pointerEvents: "none" }} />

        <div className="max-w-[1440px] mx-auto px-4">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)", marginBottom: 10, textTransform: "uppercase" as const }}>
                COMPANIES
              </div>
              <h1 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 700,
                color: "#fff", margin: 0, lineHeight: 1.4, marginBottom: 18,
              }}>
                IT/SaaS 業界の企業を知る
              </h1>
              {/* Stats chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {totalCount > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    {totalCount}社掲載中
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {casualCount}社がカジュアル面談受付中
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  ✓ 編集部審査済み
                </span>
              </div>
            </div>
            <Link href="/jobs" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(255,255,255,0.22)", textDecoration: "none",
              flexShrink: 0, alignSelf: "flex-start",
              marginTop: 4,
            }}>
              求人を探す →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Search bar panel ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1440px] mx-auto px-4">
          <Suspense>
            <CompanySearchBar industries={industries} locations={locations} />
          </Suspense>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 pt-6 pb-8">
        {/* ── 2カラムグリッド（lg以上）── */}
        <div className="[grid-template-columns:1fr] lg:[grid-template-columns:1fr_264px]"
          style={{ display: "grid", gap: 28, alignItems: "flex-start" }}>

          {/* ── メインカラム ── */}
          <div>
            {/* フィルタ適用中: 検索結果グリッド / 非適用: ジャンルカルーセル */}
            {hasFilter ? (
              <CompanySearchResults
                q={q}
                industry={industry}
                size={size}
                workStyle={workStyle}
                hiring={hiring}
                location={location}
              />
            ) : (
              <div style={{ marginTop: 4 }}>
                {genresWithCompanies.map((genre) => (
                  <GenreSection key={genre.id} genre={genre} />
                ))}
              </div>
            )}

            {/* ── 先輩に相談 CTA（モバイルでも表示） ── */}
            <div style={{
              marginTop: 32, marginBottom: 8,
              padding: "28px 32px",
              background: "var(--royal-50)",
              border: "1.5px solid var(--royal-100)",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: 8, textTransform: "uppercase" as const }}>
                  OPINIO MENTOR
                </div>
                <p style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: "clamp(14px, 1.5vw, 17px)", fontWeight: 500,
                  color: "var(--ink)", margin: 0, lineHeight: 1.55,
                }}>
                  企業を絞り込んだら、その会社の先輩に話を聞いてみよう。
                </p>
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.7 }}>
                  OPINIOのメンターは編集部が個別に声がけした現役・元社員のみ。30分・完全無料で相談できます。
                </p>
              </div>
              <Link href="/mentors" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
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

          {/* ── サイドバー（lg以上のみ表示） ── */}
          <aside className="hidden lg:block" style={{ position: "sticky", top: 88, alignSelf: "flex-start" }}>

            {/* ジャンルで探す */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "18px 16px", marginBottom: 14,
            }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
                color: "var(--ink-mute)", marginBottom: 12,
                textTransform: "uppercase" as const,
              }}>
                ジャンルで探す
              </div>
              <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {genresWithCompanies.map((genre) => (
                  <a
                    key={genre.id}
                    href={`#genre-${genre.slug}`}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 8px", borderRadius: 7, fontSize: 13, fontWeight: 500,
                      color: "var(--ink)", textDecoration: "none",
                    }}
                    className="sidebar-genre-link"
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, var(--royal), var(--accent))",
                      }} />
                      {genre.name}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: "var(--ink-mute)",
                      background: "var(--bg-tint)",
                      padding: "1px 7px", borderRadius: 100,
                    }}>
                      {genre.total_count}
                    </span>
                  </a>
                ))}
              </nav>
            </div>

            {/* メンター相談 CTA */}
            <div style={{
              background: "linear-gradient(160deg, #001233 0%, #002366 60%, #1e3a8a 100%)",
              borderRadius: 14, padding: "18px 16px", marginBottom: 14,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.13em",
                color: "rgba(255,255,255,0.55)", marginBottom: 6,
                textTransform: "uppercase" as const,
              }}>
                OPINIO MENTOR
              </div>
              <p style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: 13.5, fontWeight: 600, color: "#fff",
                lineHeight: 1.55, marginBottom: 14,
              }}>
                気になる企業の先輩に<br />話を聞いてみよう
              </p>
              <Link href="/mentors" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "10px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                color: "#fff", textDecoration: "none",
                boxShadow: "0 4px 12px rgba(245,158,11,0.35)",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                先輩に相談する（無料）
              </Link>
            </div>

            {/* 掲載統計 */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "16px",
            }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
                color: "var(--ink-mute)", marginBottom: 12,
                textTransform: "uppercase" as const,
              }}>
                掲載状況
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>掲載企業</span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 800, color: "var(--royal)", lineHeight: 1 }}>
                    {totalCount}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>社</span>
                  </span>
                </div>
                <div style={{ height: 1, background: "var(--line-soft)" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>面談受付中</span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 800, color: "var(--success)", lineHeight: 1 }}>
                    {casualCount}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>社</span>
                  </span>
                </div>
                <div style={{ height: 1, background: "var(--line-soft)" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>編集部審査済み</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>✓ 全社</span>
                </div>
              </div>
            </div>

            {/* ホバーCSS */}
            <style>{`
              .sidebar-genre-link:hover {
                background: var(--royal-50);
                color: var(--royal) !important;
              }
            `}</style>
          </aside>

        </div>
      </div>
    </div>
  );
}
