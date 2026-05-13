import type { Metadata } from "next";
import { fetchGenresWithCompanies } from "@/lib/genres";
import { GenreSection } from "@/components/companies/GenreSection";

export const metadata: Metadata = {
  title: "IT/SaaS企業を知る — Opinio",
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の企業の最新求人・組織文化・カジュアル面談情報をまとめて確認。",
};

export default async function CompaniesPage() {
  const genresWithCompanies = await fetchGenresWithCompanies();

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

      <div className="mt-6">
        {genresWithCompanies.map((genre) => (
          <GenreSection key={genre.id} genre={genre} />
        ))}
      </div>
    </div>
  );
}
