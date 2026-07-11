"use client";

import { useState } from "react";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  industry: string | null;
  phase: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
  logo_url: string | null;
};

type ReviewRow = {
  company_id: string;
  rating_overall: number | null;
  employment_status: string | null;
  pros: string | null;
};

type SalaryRow = {
  company_id: string;
  job_type: string | null;
  years_of_experience: number | null;
  annual_salary: number | null;
  employment_status: string | null;
};

function CompanyLogo({ company }: { company: Company }) {
  const logoGrad = company.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)";
  const logoLetter = company.logo_letter ?? (company.name?.[0] ?? "?");
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
      background: company.logo_url ? "#f8fafc" : logoGrad,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      {company.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logo_url} alt={company.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, fontFamily: "Inter, sans-serif" }}>{logoLetter}</span>
      )}
    </div>
  );
}

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

export default function ReviewsClient({
  reviews,
  salaries,
  companies,
}: {
  reviews: ReviewRow[];
  salaries: SalaryRow[];
  companies: Company[];
}) {
  const [tab, setTab] = useState<"reviews" | "salary">("reviews");

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));

  // 口コミ集計
  type ReviewSummary = {
    companyId: string;
    count: number;
    avgOverall: number;
    currentCount: number;
    alumniCount: number;
    topPros: string[];
  };
  const byCompany: Record<string, ReviewSummary> = {};
  for (const r of reviews) {
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
  const reviewSummaries = Object.values(byCompany)
    .map((s) => ({ ...s, avgOverall: Math.round((s.avgOverall / s.count) * 10) / 10 }))
    .filter((s) => companyMap[s.companyId])
    .sort((a, b) => b.count - a.count);

  // 給与集計（会社×職種ごと）
  type SalarySummary = {
    companyId: string;
    jobType: string;
    count: number;
    avgSalary: number;
    minSalary: number;
    maxSalary: number;
    currentCount: number;
    alumniCount: number;
    avgYears: number;
  };
  const salaryByKey: Record<string, SalarySummary> = {};
  for (const r of salaries) {
    if (!r.annual_salary || !r.job_type) continue;
    const key = `${r.company_id}::${r.job_type}`;
    if (!salaryByKey[key]) {
      salaryByKey[key] = {
        companyId: r.company_id,
        jobType: r.job_type,
        count: 0,
        avgSalary: 0,
        minSalary: Infinity,
        maxSalary: -Infinity,
        currentCount: 0,
        alumniCount: 0,
        avgYears: 0,
      };
    }
    const s = salaryByKey[key];
    s.count++;
    s.avgSalary += r.annual_salary;
    if (r.annual_salary < s.minSalary) s.minSalary = r.annual_salary;
    if (r.annual_salary > s.maxSalary) s.maxSalary = r.annual_salary;
    if (r.employment_status === "current") s.currentCount++;
    else s.alumniCount++;
    s.avgYears += r.years_of_experience ?? 0;
  }
  const salarySummaries = Object.values(salaryByKey)
    .map((s) => ({
      ...s,
      avgSalary: Math.round(s.avgSalary / s.count),
      avgYears: Math.round((s.avgYears / s.count) * 10) / 10,
    }))
    .filter((s) => companyMap[s.companyId])
    .sort((a, b) => b.avgSalary - a.avgSalary);

  const totalReviews = reviewSummaries.reduce((acc, s) => acc + s.count, 0);
  const totalSalaries = salaries.length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: 99,
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    background: active ? "var(--royal)" : "transparent",
    color: active ? "#fff" : "var(--ink-soft)",
    border: active ? "none" : "1px solid var(--line)",
    cursor: "pointer",
  });

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px 80px" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
          口コミ・給与
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)" }}>
          IT/SaaS企業で働く社員・OBによるリアルな声。
        </p>
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <button style={tabStyle(tab === "reviews")} onClick={() => setTab("reviews")}>
          口コミ <span style={{ fontSize: 12, opacity: 0.75 }}>{totalReviews}</span>
        </button>
        <button style={tabStyle(tab === "salary")} onClick={() => setTab("salary")}>
          給与 <span style={{ fontSize: 12, opacity: 0.75 }}>{totalSalaries}</span>
        </button>
      </div>

      {/* 口コミタブ */}
      {tab === "reviews" && (
        reviewSummaries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 15 }}>まだ口コミがありません</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviewSummaries.map((s) => {
              const company = companyMap[s.companyId];
              if (!company) return null;
              return (
                <Link key={s.companyId} href={`/companies/${s.companyId}#reviews`} style={{ textDecoration: "none", display: "block" }}>
                  <div className="review-company-card">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                      <CompanyLogo company={company} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{company.name}</span>
                          {company.industry && (
                            <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "var(--line-soft)", color: "var(--ink-soft)" }}>
                              {company.industry}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: s.topPros.length > 0 ? 10 : 0, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "Inter, sans-serif", color: "#B45309" }}>
                            {s.avgOverall.toFixed(1)}
                          </span>
                          <Stars value={s.avgOverall} />
                          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{s.count}件</span>
                          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>現役 {s.currentCount} / OB {s.alumniCount}</span>
                        </div>
                        {s.topPros[0] && (
                          <p style={{
                            margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6,
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          }}>
                            👍 {s.topPros[0]}
                          </p>
                        )}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 4 }}>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      )}

      {/* 給与タブ */}
      {tab === "salary" && (
        salarySummaries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💴</div>
            <p style={{ fontSize: 15 }}>まだ給与データがありません</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* ヘッダー行 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 140px 80px",
              gap: 8,
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-mute)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              <span>企業 / 職種</span>
              <span style={{ textAlign: "right" }}>平均年収</span>
              <span style={{ textAlign: "center" }}>レンジ</span>
              <span style={{ textAlign: "center" }}>件数</span>
            </div>

            {salarySummaries.map((s, i) => {
              const company = companyMap[s.companyId];
              if (!company) return null;
              const prevCompanyId = i > 0 ? salarySummaries[i - 1].companyId : null;
              const showCompanyHeader = s.companyId !== prevCompanyId;
              return (
                <div key={`${s.companyId}-${s.jobType}`}>
                  {showCompanyHeader && (
                    <Link href={`/companies/${s.companyId}#reviews`} style={{ textDecoration: "none", display: "block" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "12px 16px 8px",
                        marginTop: i > 0 ? 16 : 0,
                      }}>
                        <CompanyLogo company={company} />
                        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{company.name}</span>
                        {company.industry && (
                          <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "var(--line-soft)", color: "var(--ink-soft)" }}>
                            {company.industry}
                          </span>
                        )}
                      </div>
                    </Link>
                  )}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 140px 80px",
                    gap: 8,
                    padding: "10px 16px",
                    background: "#fff",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    marginBottom: 2,
                    alignItems: "center",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.jobType}</span>
                    <span style={{ textAlign: "right", fontSize: 16, fontWeight: 900, fontFamily: "Inter, sans-serif", color: "var(--success)" }}>
                      {Math.round(s.avgSalary / 10000)}万円
                    </span>
                    <span style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)" }}>
                      {s.minSalary === s.maxSalary
                        ? `${Math.round(s.minSalary / 10000)}万円`
                        : `${Math.round(s.minSalary / 10000)}〜${Math.round(s.maxSalary / 10000)}万円`}
                    </span>
                    <span style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)" }}>{s.count}件</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* CTA */}
      <div style={{ marginTop: 40, padding: "20px 24px", background: "var(--royal-50)", borderRadius: 16, textAlign: "center" }}>
        <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>
          在籍・在籍経験のある企業の口コミ・給与を投稿してください
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--ink-soft)" }}>
          匿名で投稿できます。編集部確認後に公開されます。
        </p>
        <Link href="/companies" style={{
          display: "inline-block", padding: "10px 24px", borderRadius: 10,
          background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}>
          企業を探して投稿する →
        </Link>
      </div>
    </main>
  );
}
