import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { fetchGenresWithCompanies } from "@/lib/genres";
import { fetchDistinctIndustries, fetchDistinctLocations } from "@/lib/search/companies";
import { createClient } from "@/lib/supabase/server";
import { GenreTabs } from "@/components/companies/GenreTabs";
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
  const [industries, locations, genresWithCompanies, companyNamesResult] = await Promise.all([
    fetchDistinctIndustries(),
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

  return (
    <div style={{ background: "#f0f4f8" }}>
      <h1 className="sr-only">企業を知る</h1>

      {/* ── Search bar panel ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1440px] mx-auto px-4">
          <Suspense>
            <CompanySearchBar industries={industries} locations={locations} companySuggestions={companySuggestions} />
          </Suspense>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 pt-6 pb-8">

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
          <div style={{ marginTop: 16 }}>
            <GenreTabs genres={genresWithCompanies} />
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
