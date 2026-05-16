import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchGenresWithCompanies } from "@/lib/genres";
import { fetchDistinctIndustries, fetchDistinctLocations } from "@/lib/search/companies";
import { GenreSection } from "@/components/companies/GenreSection";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";

export const metadata: Metadata = {
  title: "IT/SaaS企業を知る — Opinio",
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の企業の最新求人・組織文化・カジュアル面談情報をまとめて確認。",
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">Opinio / 企業を知る</p>
        <h1
          className="text-2xl font-medium mb-1"
          style={{ fontFamily: "serif" }}
        >
          企業を、知る。
        </h1>
        <p className="text-sm text-gray-500">
          IT/SaaS業界をジャンル別に。気になる1社が必ず見つかる。
        </p>
      </div>

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
