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
    <div className="max-w-7xl mx-auto px-4 pt-5 pb-6">
      {/* 検索バー（常に表示） */}
      <Suspense>
        <CompanySearchBar industries={industries} locations={locations} />
      </Suspense>

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
  );
}
