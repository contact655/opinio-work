"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

type AccessInfo = {
  hasAccess: boolean;
  expiresAt: string | null;
  gateEnabled: boolean;
};

type ReviewableCompany = { id: string | null; name: string; isCurrent: boolean; isRegistered: boolean };

const JOB_TYPES_MAJOR = [
  "営業", "マーケティング", "カスタマーサクセス", "プロダクトマネージャー",
  "エンジニア", "デザイナー", "事業開発", "コーポレート", "経営幹部", "その他"
];


const REPORT_REASONS = ["虚偽の内容", "誹謗中傷", "個人が特定できる内容", "その他"];

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

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "inline-flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button"
          onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill={s <= (hovered || value) ? "#F59E0B" : "#E2E8F0"} style={{ transition: "fill 0.1s" }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
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
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "salary" ? "salary" : "reviews";
  const [tab, setTab] = useState<"reviews" | "salary">(initialTab as "reviews" | "salary");
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [postModal, setPostModal] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    setTab(t === "salary" ? "salary" : "reviews");
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/review-access")
      .then((r) => r.json())
      .then(setAccessInfo)
      .catch(() => {});
  }, []);

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

  const _totalReviews = reviewSummaries.reduce((acc, s) => acc + s.count, 0);
  const _totalSalaries = salaries.length;

  const gateActive = accessInfo?.gateEnabled && !accessInfo.hasAccess;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px 80px" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
          {tab === "reviews" ? "口コミ" : "給与"}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)" }}>
          IT/SaaS企業で働く社員・OBによるリアルな声。
        </p>
      </div>

      {/* 閲覧権バナー */}
      {accessInfo?.hasAccess && accessInfo.expiresAt && (
        <div style={{ marginBottom: 20, padding: "10px 16px", background: "var(--success-soft)", borderRadius: 10, border: "1px solid #A7F3D0", fontSize: 13, color: "#065F46", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✅</span>
          <span>
            口コミの閲覧権があります（{new Date(accessInfo.expiresAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}まで）
          </span>
        </div>
      )}

      {/* Give First ゲート */}
      {gateActive && (
        <div style={{
          background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
          borderRadius: 16, padding: "32px 28px", marginBottom: 28,
          color: "#fff", textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            口コミを見るには、あなたも投稿してください
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 14, opacity: 0.85, lineHeight: 1.7, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            OPINIOの口コミは、実際にその企業で働いた人だけが書いています。
            あなたも1件投稿すると、すべての口コミが1年間読めるようになります。
          </p>
          <ul style={{ listStyle: "none", margin: "0 0 24px", padding: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            {["投稿は匿名です", "在籍企業に通知されることはありません", "投稿した瞬間に読めるようになります（運営の承認を待つ必要はありません）"].map(t => (
              <li key={t} style={{ fontSize: 13, opacity: 0.8 }}>・{t}</li>
            ))}
          </ul>
          <button
            onClick={() => setPostModal(true)}
            style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: "var(--warm)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
          >
            口コミを投稿する →
          </button>
        </div>
      )}

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
                  <div className="review-company-card" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px", transition: "box-shadow 0.15s" }}>
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
                            ...(gateActive ? { filter: "blur(5px)", userSelect: "none" } : {}),
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
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", ...(gateActive ? { filter: "blur(4px)", userSelect: "none" } : {}) }}>{s.jobType}</span>
                    <span style={{ textAlign: "right", fontSize: 16, fontWeight: 900, fontFamily: "Inter, sans-serif", color: "var(--success)", ...(gateActive ? { filter: "blur(4px)", userSelect: "none" } : {}) }}>
                      {Math.round(s.avgSalary / 10000)}万円
                    </span>
                    <span style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)", ...(gateActive ? { filter: "blur(4px)", userSelect: "none" } : {}) }}>
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

      {/* 投稿ボタン */}
      <div style={{ marginTop: 48, textAlign: "center" }}>
        <button
          onClick={() => setPostModal(true)}
          style={{
            padding: "14px 36px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
            color: "#fff", fontSize: 15, fontWeight: 800,
            cursor: "pointer", boxShadow: "0 4px 16px rgba(0,35,102,0.25)",
          }}
        >
          口コミ・給与を投稿する
        </button>
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mute)" }}>
          匿名 / 投稿した瞬間に閲覧権が付与されます
        </p>
      </div>

      {/* 投稿モーダル */}
      {postModal && (
        <PostModal onClose={() => setPostModal(false)} onSuccess={() => { setPostModal(false); }} />
      )}
    </main>
  );
}

// ── 投稿モーダル（3ステップ）──────────────────────────────────────────────
function PostModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [companies, setCompanies] = useState<ReviewableCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<ReviewableCompany | null>(null);
  const [postType, setPostType] = useState<"review" | "salary" | null>(null);
  const [done, setDone] = useState(false);

  // Review form
  const [empStatus, setEmpStatus] = useState<"current" | "alumni">("current");
  const [jobType, setJobType] = useState("");
  const [ratingOverall, setRatingOverall] = useState(0);
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");

  // Salary form
  const [salaryJobType, setSalaryJobType] = useState("");
  const [years, setYears] = useState("");
  const [salary, setSalary] = useState("");
  const [salaryEmpStatus, setSalaryEmpStatus] = useState<"current" | "alumni">("current");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reviewable-companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies ?? []))
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false));
  }, []);

  async function submitReview() {
    if (!selectedCompany || !ratingOverall) { setError("総合評価を選択してください"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/company-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: selectedCompany.id, employment_status: empStatus, rating_overall: ratingOverall, pros: pros || null, cons: cons || null, job_type: jobType || null }),
    });
    setSubmitting(false);
    if (res.status === 401) { window.location.href = `/auth?next=/reviews`; return; }
    if (res.status === 403) { setError("在籍または在籍経験のある企業にのみ投稿できます。職務経歴を登録してください。"); return; }
    if (!res.ok) { setError("送信に失敗しました"); return; }
    setDone(true);
    setTimeout(onSuccess, 2000);
  }

  async function submitSalary() {
    if (!selectedCompany || !salaryJobType || !salary) { setError("職種と年収を入力してください"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/salary-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: selectedCompany.id, job_type: salaryJobType, years_of_experience: years ? parseInt(years) : null, annual_salary: parseInt(salary) * 10000, employment_status: salaryEmpStatus }),
    });
    setSubmitting(false);
    if (res.status === 401) { window.location.href = `/auth?next=/reviews`; return; }
    if (res.status === 403) { setError("在籍または在籍経験のある企業にのみ投稿できます。職務経歴を登録してください。"); return; }
    if (!res.ok) { setError("送信に失敗しました"); return; }
    setDone(true);
    setTimeout(onSuccess, 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box" as const, padding: "9px 12px",
    borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block" as const, marginBottom: 6 };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

        {/* ヘッダー */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, background: "#fff", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 2 }}>
              ステップ {step} / 3
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
              {step === 1 ? "企業を選ぶ" : step === 2 ? "種類を選ぶ" : postType === "review" ? "口コミを書く" : "給与を入力する"}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--ink-mute)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>投稿ありがとうございます！</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
                閲覧権が付与されました。口コミをご覧いただけます。
              </div>
            </div>
          ) : step === 1 ? (
            // Step 1: 企業選択
            <div>
              {loadingCompanies ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-mute)" }}>読み込み中...</div>
              ) : companies.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                    口コミを投稿するには職務経歴の登録が必要です
                  </div>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20 }}>
                    在籍または在籍経験のある企業にのみ口コミを投稿できます。
                  </p>
                  <Link href="/profile/edit?tab=career" onClick={onClose}
                    style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, background: "var(--royal)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                    職務経歴を登録する →
                  </Link>
                </div>
              ) : companies.every(c => !c.isRegistered) ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                    在籍企業がOPINIOにまだ掲載されていません
                  </div>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.7 }}>
                    現在、口コミはOPINIOに掲載済みの企業のみ投稿できます。
                  </p>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.7 }}>
                    掲載を希望する場合は <a href="mailto:contact@opinio.co.jp" style={{ color: "var(--royal)" }}>contact@opinio.co.jp</a> までご連絡ください。
                  </p>
                  {companies.map(c => (
                    <div key={c.name} style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 4 }}>· {c.name}</div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-soft)" }}>
                    職務経歴に登録されている企業のみ選択できます。
                  </p>
                  {companies.map((c) => (
                    c.isRegistered ? (
                      <button
                        key={c.id ?? c.name}
                        type="button"
                        onClick={() => { setSelectedCompany(c); setStep(2); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                          background: "#fff", border: "1.5px solid var(--line)", borderRadius: 12,
                          cursor: "pointer", textAlign: "left" as const, fontFamily: "inherit",
                          transition: "border-color 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                            {c.isCurrent ? "現職" : "元在籍"}
                          </div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ marginLeft: "auto" }}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    ) : (
                      <div
                        key={c.name}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                          background: "var(--line-soft)", border: "1.5px solid var(--line)", borderRadius: 12,
                          cursor: "not-allowed", opacity: 0.65,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                            {c.isCurrent ? "現職" : "元在籍"} · OPINIOに未掲載のため投稿不可
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          ) : step === 2 ? (
            // Step 2: 種類選択
            <div>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--ink-soft)" }}>
                <strong>{selectedCompany?.name}</strong> に対して投稿する内容を選んでください。
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { type: "review" as const, title: "💬 口コミ", desc: "職場の雰囲気、成長機会、WLBなどを評価・コメント" },
                  { type: "salary" as const, title: "💴 給与", desc: "職種別の年収データを匿名投稿" },
                ].map(({ type, title, desc }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setPostType(type); setStep(3); setError(""); }}
                    style={{
                      display: "flex", flexDirection: "column", gap: 4, padding: "16px 20px",
                      background: "#fff", border: "1.5px solid var(--line)", borderRadius: 12,
                      cursor: "pointer", textAlign: "left" as const, fontFamily: "inherit",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{desc}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--ink-mute)", padding: 0 }}>
                ← 企業を選び直す
              </button>
            </div>
          ) : postType === "review" ? (
            // Step 3a: 口コミフォーム
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
                <strong>{selectedCompany?.name}</strong> の口コミを匿名投稿
              </p>
              <div>
                <label style={labelStyle}>在籍ステータス</label>
                <select value={empStatus} onChange={(e) => setEmpStatus(e.target.value as "current" | "alumni")} style={inputStyle}>
                  <option value="current">現職</option>
                  <option value="alumni">元社員・OB/OG</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>職種（大分類）</label>
                <select value={jobType} onChange={(e) => setJobType(e.target.value)} style={inputStyle}>
                  <option value="">選択しない</option>
                  {JOB_TYPES_MAJOR.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>総合評価 * <span style={{ fontWeight: 400 }}>{ratingOverall > 0 ? `（${ratingOverall}/5）` : ""}</span></label>
                <StarInput value={ratingOverall} onChange={setRatingOverall} />
              </div>
              <div>
                <label style={labelStyle}>良い点</label>
                <textarea value={pros} onChange={(e) => setPros(e.target.value)} rows={3} placeholder="チームの雰囲気、成長機会、働きやすさなど"
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>改善点・課題</label>
                <textarea value={cons} onChange={(e) => setCons(e.target.value)} rows={3} placeholder="改善してほしい点、難しいと感じる点など"
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              {error && (
                <div style={{ fontSize: 13, color: "var(--error)", padding: "8px 12px", background: "var(--error-soft)", borderRadius: 8 }}>
                  {error.includes("職務経歴") ? (
                    <>{error} <Link href="/profile/edit?tab=career" style={{ color: "var(--royal)", fontWeight: 700 }}>職務経歴を登録する →</Link></>
                  ) : error}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setStep(2); setError(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" }}>
                  ← 戻る
                </button>
                <button onClick={submitReview} disabled={submitting || !ratingOverall}
                  style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: submitting || !ratingOverall ? "var(--line)" : "var(--royal)", color: submitting || !ratingOverall ? "var(--ink-mute)" : "#fff", fontSize: 13, fontWeight: 700, cursor: submitting || !ratingOverall ? "not-allowed" : "pointer" }}>
                  {submitting ? "送信中..." : "匿名で投稿する"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", textAlign: "center" }}>
                投稿は匿名です。承認を待たずに即座に閲覧権が付与されます。
              </p>
            </div>
          ) : (
            // Step 3b: 給与フォーム
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
                <strong>{selectedCompany?.name}</strong> での給与を匿名投稿
              </p>
              <div>
                <label style={labelStyle}>在籍ステータス</label>
                <select value={salaryEmpStatus} onChange={(e) => setSalaryEmpStatus(e.target.value as "current" | "alumni")} style={inputStyle}>
                  <option value="current">現職</option>
                  <option value="alumni">元社員・OB/OG</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>職種 *</label>
                <select value={salaryJobType} onChange={(e) => setSalaryJobType(e.target.value)} style={inputStyle} required>
                  <option value="">選択してください</option>
                  {JOB_TYPES_MAJOR.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>在籍年数</label>
                <select value={years} onChange={(e) => setYears(e.target.value)} style={inputStyle}>
                  <option value="">選択しない</option>
                  {[1,2,3,4,5,6,7,8,9,10,15,20].map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>年収（万円） *</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} min={200} max={10000} placeholder="例: 700"
                    style={{ flex: 1, ...inputStyle }} />
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                </div>
              </div>
              {error && (
                <div style={{ fontSize: 13, color: "var(--error)", padding: "8px 12px", background: "var(--error-soft)", borderRadius: 8 }}>
                  {error.includes("職務経歴") ? (
                    <>{error} <Link href="/profile/edit?tab=career" style={{ color: "var(--royal)", fontWeight: 700 }}>職務経歴を登録する →</Link></>
                  ) : error}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setStep(2); setError(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" }}>
                  ← 戻る
                </button>
                <button onClick={submitSalary} disabled={submitting || !salaryJobType || !salary}
                  style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: submitting || !salaryJobType || !salary ? "var(--line)" : "var(--royal)", color: submitting || !salaryJobType || !salary ? "var(--ink-mute)" : "#fff", fontSize: 13, fontWeight: 700, cursor: submitting || !salaryJobType || !salary ? "not-allowed" : "pointer" }}>
                  {submitting ? "送信中..." : "匿名で投稿する"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", textAlign: "center" }}>
                投稿は匿名です。承認を待たずに即座に閲覧権が付与されます。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 通報モーダル ──────────────────────────────────────────────────────────
export function ReviewReportModal({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason) return;
    setSubmitting(true);
    const res = await fetch("/api/review-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_id: reviewId, reason, detail, contact_email: email }),
    });
    setSubmitting(false);
    if (res.ok) setDone(true);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>通報を受け付けました</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6 }}>内容を確認の上、対応いたします。</div>
            <button onClick={onClose} style={{ marginTop: 20, padding: "8px 24px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer" }}>閉じる</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>口コミを通報</h3>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-mute)" }}>×</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 6 }}>通報理由 *</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit" }}>
                <option value="">選択してください</option>
                {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 6 }}>詳細</label>
              <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3}
                style={{ width: "100%", boxSizing: "border-box" as const, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 6 }}>連絡先メールアドレス</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="返信が必要な場合のみ"
                style={{ width: "100%", boxSizing: "border-box" as const, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" }}>キャンセル</button>
              <button onClick={submit} disabled={!reason || submitting}
                style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", background: !reason || submitting ? "var(--line)" : "var(--error)", color: !reason || submitting ? "var(--ink-mute)" : "#fff", fontSize: 13, fontWeight: 700, cursor: !reason || submitting ? "not-allowed" : "pointer" }}>
                {submitting ? "送信中..." : "通報する"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
