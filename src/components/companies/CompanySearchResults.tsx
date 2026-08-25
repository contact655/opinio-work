// src/components/companies/CompanySearchResults.tsx
// 検索結果グリッド — Server Component
// キーワード / フィルタが適用されているときのみ表示（カルーセルの代わり）

import Link from "next/link";
import { INDUSTRY_GROUPS } from "@/lib/search/industryGroups";
import { searchCompanies } from "@/lib/search/companies";
import type { WorkStyleValue } from "@/lib/search/companies";
import { CompanyCardList } from "./CompanyCardList";

type Props = {
  q?: string;
  phase?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
  industry?: string;
  foreign?: string;
};

export async function CompanySearchResults({ q, phase, workStyle, hiring, location, industry, foreign }: Props) {
  const params = {
    q: q || undefined,
    phase: phase || undefined,
    workStyle: (workStyle as WorkStyleValue) || undefined,
    hiring: hiring === "1" ? true : undefined,
    location: location || undefined,
    industry: industry || undefined,
    foreign: foreign === "1" ? true : undefined,
  };

  const { companies, totalCount } = await searchCompanies(params);

  return (
    <>
      <style>{`
        .search-results-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 641px) {
          .search-results-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
        @media (min-width: 1025px) {
          .search-results-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
        }

        /* genre-card は globals.css にも定義があるが、ここでも定義する（絞り込み結果の枠内で完結させるため）。

           ⚠️ このコメントに 山括弧 と 二重引用符 を書かないこと。
              JSX の style タグの中身は**サーバーだけが実体参照へ変換する**ため、
              クライアントの描画と一致せず hydration error になる。
              2026-08-11 まで、ここに山括弧つきで style タグ名が書かれており、
              絞り込み中の /companies を開くたびに毎回発生していた。
              同日その注意書き自体に山括弧を含めてしまい、再発させている（2度踏んだ）。 */
        .genre-card {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.07), 0 4px 16px rgba(15, 23, 42, 0.08);
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
          height: 100%;
          will-change: transform;
        }
        .genre-card:hover {
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.12);
          transform: translateY(-10px) scale(1.01);
        }
        .genre-card:active {
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(15, 23, 42, 0.08);
          transform: translateY(-2px) scale(0.98);
          transition-duration: 0.06s;
        }
      `}</style>

      {/* ヒット件数ヘッダー */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          {totalCount}社
        </span>
        <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>が見つかりました</span>
      </div>

      {/* 検索結果グリッド */}
      {companies.length === 0 ? (
        <div style={{
          background: "var(--bg-tint)",
          borderRadius: 16,
          padding: "56px 24px",
          textAlign: "center",
          border: "1px solid var(--line)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--royal-50)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            条件に合う企業が見つかりませんでした
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            検索キーワードを変えるか、絞り込み条件を減らしてみてください
          </p>
          {/* 提案アクション */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "9px 20px", borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              background: "var(--royal)", color: "#fff",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(0,35,102,0.20)",
            }}>
              すべての企業を見る →
            </Link>
            <Link href="/companies?hiring=1" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "9px 20px", borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              background: "#fff7ed", color: "#c2410c",
              border: "1px solid #fed7aa",
              textDecoration: "none",
            }}>
              面談受付中の企業を見る
            </Link>
          </div>

          {/* 業種から辿り直す導線（2026-08-05 追加）。
              ⚠️ キーワードを変えるか条件を減らすか、の2択で行き止まりにしないため。
                 URL は LP の業種チップと同じ形式（/companies?industry=<key>）に揃えている。 */}
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 12 }}>
              業種から探す
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {INDUSTRY_GROUPS.map((g) => (
                <Link
                  key={g.key}
                  href={`/companies?industry=${g.key}`}
                  style={{
                    padding: "7px 14px", borderRadius: 100,
                    background: "#fff", border: "1px solid var(--line)",
                    fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="search-results-grid">
          {companies.map((company) => (
            <CompanyCardList key={company.id} company={company} compact />
          ))}
        </div>
      )}
    </>
  );
}
