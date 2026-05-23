import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchGenresWithCompanies } from "@/lib/genres";
import { fetchDistinctIndustries, fetchDistinctLocations } from "@/lib/search/companies";
import { GenreSection } from "@/components/companies/GenreSection";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";

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

  // 業種・都道府県一覧は常に取得（検索バーのドロップダウン用）
  const [industries, locations] = await Promise.all([
    fetchDistinctIndustries(),
    fetchDistinctLocations(),
  ]);

  // カルーセル用ジャンルデータはフィルタなしの場合のみ取得
  const genresWithCompanies = hasFilter ? [] : await fetchGenresWithCompanies();

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "28px 0 24px" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: 6 }}>
                COMPANIES
              </div>
              <h1 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 500,
                color: "var(--ink)", margin: 0, lineHeight: 1.4,
              }}>
                IT/SaaS 業界の企業を知る
              </h1>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.7 }}>
                {genresWithCompanies.length > 0
                  ? `${genresWithCompanies.reduce((s, g) => s + g.total_count, 0)}社掲載中 · カジュアル面談・求人情報をまとめて確認`
                  : "カジュアル面談・求人情報をまとめて確認"
                }
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
              <a href="/jobs" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "1.5px solid var(--line)", background: "#fff",
                color: "var(--ink-soft)", textDecoration: "none",
              }}>
                求人を探す →
              </a>
            </div>
          </div>
          {/* 検索バー */}
          <Suspense>
            <CompanySearchBar industries={industries} locations={locations} />
          </Suspense>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">

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
          <div className="mt-6">
            {genresWithCompanies.map((genre) => (
              <GenreSection key={genre.id} genre={genre} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
