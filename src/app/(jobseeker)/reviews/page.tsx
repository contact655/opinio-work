import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "口コミ・給与 | OPINIO",
  description: "IT/SaaS企業の社員・OBによるリアルな口コミと給与データ。",
};

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill={s <= Math.round(value) ? "#F59E0B" : "#E2E8F0"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  const admin = createAdminClient();

  // 承認済み口コミを会社別に集計
  const { data: reviews } = await admin
    .from("ow_company_reviews")
    .select("company_id, rating_overall, rating_culture, rating_growth, rating_wlb, rating_compensation, rating_leadership, rating_business, rating_welfare, employment_status, pros")
    .eq("is_approved", true);

  // 会社情報を取得
  const { data: companies } = await admin
    .from("ow_companies")
    .select("id, name, industry, phase, logo_gradient, logo_letter, logo_url")
    .eq("is_published", true);

  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c]));

  // 会社別に集計
  type CompanySummary = {
    companyId: string;
    count: number;
    avgOverall: number;
    currentCount: number;
    alumniCount: number;
    topPros: string[];
  };

  const byCompany: Record<string, CompanySummary> = {};
  for (const r of reviews ?? []) {
    if (!byCompany[r.company_id]) {
      byCompany[r.company_id] = { companyId: r.company_id, count: 0, avgOverall: 0, currentCount: 0, alumniCount: 0, topPros: [] };
    }
    const s = byCompany[r.company_id];
    s.count++;
    s.avgOverall += r.rating_overall ?? 0;
    if (r.employment_status === "current") s.currentCount++;
    else s.alumniCount++;
    if (r.pros && s.topPros.length < 2) s.topPros.push(r.pros);
  }

  const summaries = Object.values(byCompany)
    .map((s) => ({ ...s, avgOverall: Math.round((s.avgOverall / s.count) * 10) / 10 }))
    .filter((s) => companyMap[s.companyId])
    .sort((a, b) => b.count - a.count);

  const totalReviews = summaries.reduce((acc, s) => acc + s.count, 0);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px 80px" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
          口コミ・給与
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)" }}>
          IT/SaaS企業で働く社員・OBによるリアルな声。{summaries.length}社・{totalReviews}件の口コミを掲載中。
        </p>
      </div>

      {summaries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <p style={{ fontSize: 15 }}>まだ口コミがありません</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {summaries.map((s) => {
            const company = companyMap[s.companyId];
            if (!company) return null;
            const logoGrad = company.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)";
            const logoLetter = company.logo_letter ?? (company.name?.[0] ?? "?");

            return (
              <Link
                key={s.companyId}
                href={`/companies/${s.companyId}#reviews`}
                style={{ textDecoration: "none", display: "block" }}
              >
                <div className="review-company-card">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    {/* ロゴ */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: company.logo_url ? "#f8fafc" : logoGrad,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      {company.logo_url ? (
                        <img src={company.logo_url} alt={company.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, fontFamily: "Inter, sans-serif" }}>{logoLetter}</span>
                      )}
                    </div>

                    {/* メイン情報 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{company.name}</span>
                        {company.industry && (
                          <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "var(--line-soft)", color: "var(--ink-soft)" }}>
                            {company.industry}
                          </span>
                        )}
                      </div>

                      {/* 評価 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: s.topPros.length > 0 ? 10 : 0, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "Inter, sans-serif", color: "#B45309" }}>
                          {s.avgOverall.toFixed(1)}
                        </span>
                        <Stars value={s.avgOverall} />
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{s.count}件</span>
                        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                          現役 {s.currentCount} / OB {s.alumniCount}
                        </span>
                      </div>

                      {/* 口コミ抜粋 */}
                      {s.topPros[0] && (
                        <p style={{
                          margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6,
                          overflow: "hidden", textOverflow: "ellipsis",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                        }}>
                          👍 {s.topPros[0]}
                        </p>
                      )}
                    </div>

                    {/* 矢印 */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 4 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 40, padding: "20px 24px", background: "var(--royal-50)", borderRadius: 16, textAlign: "center" }}>
        <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>
          在籍・在籍経験のある企業の口コミを投稿してください
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--ink-soft)" }}>
          匿名で投稿できます。編集部確認後に公開されます。
        </p>
        <Link href="/companies" style={{
          display: "inline-block", padding: "10px 24px", borderRadius: 10,
          background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}>
          企業を探して口コミを投稿する →
        </Link>
      </div>
    </main>
  );
}
