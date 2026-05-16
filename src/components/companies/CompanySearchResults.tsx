// src/components/companies/CompanySearchResults.tsx
// 検索結果グリッド — Server Component
// キーワード / フィルタが適用されているときのみ表示（カルーセルの代わり）

import { searchCompanies } from "@/lib/search/companies";
import type { SizeRange, WorkStyleValue } from "@/lib/search/companies";
import { CompanyCardCompact } from "./CompanyCardCompact";

type Props = {
  q?: string;
  industry?: string;
  size?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
};

export async function CompanySearchResults({ q, industry, size, workStyle, hiring, location }: Props) {
  const params = {
    q: q || undefined,
    industry: industry || undefined,
    size: (size as SizeRange) || undefined,
    workStyle: (workStyle as WorkStyleValue) || undefined,
    hiring: hiring === "1" ? true : undefined,
    location: location || undefined,
  };

  const { companies, totalCount } = await searchCompanies(params);

  return (
    <>
      <style>{`
        .search-results-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }
        @media (max-width: 640px) {
          .search-results-grid { grid-template-columns: repeat(1, 1fr); }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .search-results-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1025px) and (max-width: 1280px) {
          .search-results-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1281px) {
          .search-results-grid { grid-template-columns: repeat(5, 1fr); }
        }

        /* genre-card が GenreCarousel の <style> に依存しているため、ここでも定義 */
        .genre-card {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.06);
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.18s ease, transform 0.18s ease;
          cursor: pointer;
          height: 100%;
        }
        .genre-card:hover {
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.08);
          transform: translateY(-2px);
        }
      `}</style>

      {/* ヒット件数ヘッダー */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1d24" }}>
          {totalCount}社
        </span>
        <span style={{ fontSize: 13, color: "#8b95a3" }}>が見つかりました</span>
      </div>

      {/* 検索結果グリッド */}
      {companies.length === 0 ? (
        <div style={{
          background: "#f8fafc",
          borderRadius: 12,
          padding: "48px 24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1d24", marginBottom: 6 }}>
            条件に合う企業が見つかりませんでした
          </p>
          <p style={{ fontSize: 13, color: "#8b95a3" }}>
            キーワードや絞り込み条件を変えてお試しください
          </p>
        </div>
      ) : (
        <div className="search-results-grid">
          {companies.map((company) => (
            <CompanyCardCompact key={company.id} company={company} />
          ))}
        </div>
      )}
    </>
  );
}
