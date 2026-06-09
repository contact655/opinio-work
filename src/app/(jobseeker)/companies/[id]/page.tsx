import type { Metadata } from "next";
import { CompanyLogoImage } from "@/components/companies/CompanyLogoImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  getCompanyById,
  getCompanyPhotos,
  getCompanyRecruiters,
  getArticlesByCompany,
  getCompanyEmployees,
  getSimilarCompanies,
} from "@/lib/supabase/queries";
import type { CompanyPhoto, CompanyRecruiter, CompanyEmployee, CompanyEmployeeCategoryItem } from "@/lib/supabase/queries";
import type { Article } from "@/app/articles/mockArticleData";
import { TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";
import type { Company } from "@/app/companies/mockCompanies";
import { formatUpdated } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { PhotoCarousel } from "./PhotoCarousel";
import BookmarkButton, { CompanyStickyNav, RecentlyViewedTracker } from "./CompanyDetailClient";
import { HeroCompareButton } from "./HeroCompareButton";
import { JobAccordionItem } from "./JobAccordionItem";
import OrgTeamsSectionClient from "./OrgTeamsSectionClient";
import CustomerCasesClient from "./CustomerCasesClient";
// import { GenreCarousel } from "@/components/companies/GenreCarousel";
import EvaluationText from "./EvaluationText";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { BackToTop } from "@/components/jobseeker/BackToTop";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarColor } from "@/lib/jobCategoryColors";
import { JOB_GROUPING_THRESHOLD } from "@/lib/constants";

// Deduplicate getCompanyById calls within a single request
// (generateMetadata and CompanyDetailPage both call it)
const getCompanyByIdCached = cache(getCompanyById);



// 5分間 ISR キャッシュ
export const revalidate = 300;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getCompanyByIdCached(params.id);
  if (!result) return { title: "企業が見つかりません | OPINIO" };
  const { company } = result;

  const description = company.tagline
    ? `${company.tagline}｜${company.industry ?? "IT/SaaS"}業界・${company.employee_count ? company.employee_count.toString() + "名規模" : "詳細はページへ"}。カジュアル面談受付中。`
    : `${company.name}の企業情報・求人・組織文化をOPINIOで確認。カジュアル面談で現場の声を聞けます。`;

  const ogImageUrl = `/api/og?type=company&name=${encodeURIComponent(company.name)}&sub=${encodeURIComponent(company.tagline ?? "")}&badge=${encodeURIComponent(company.industry ?? "IT/SaaS")}`;

  return {
    title: `${company.name} — 企業情報・求人 | OPINIO`,
    description,
    alternates: { canonical: `/companies/${params.id}` },
    keywords: [company.name, company.industry ?? "", "カジュアル面談", "IT転職", "SaaS転職"].filter(Boolean),
    openGraph: {
      title: `${company.name} | OPINIO`,
      description,
      type: "website",
      url: `/companies/${params.id}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: company.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${company.name} | OPINIO`,
      description,
      images: [ogImageUrl],
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Breadcrumb({ company }: { company: Company }) {
  return (
    <nav
      aria-label="パンくずリスト"
      style={{
        background: "var(--bg-tint)",
        borderBottom: "1px solid var(--line)",
        fontSize: "var(--text-xs)",
        color: "var(--ink-mute)",
      }}
    >
      <div
        style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
        className="px-5 py-3 md:px-12"
      >
        <Link href="/" style={{ color: "var(--ink-mute)" }}>
          OPINIO
        </Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href="/companies" style={{ color: "var(--ink-mute)" }}>
          企業を知る
        </Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span aria-current="page" style={{ color: "var(--ink-soft)" }}>{company.name}</span>
      </div>
    </nav>
  );
}

function Hero({
  company,
  detail,
  initialBookmarked,
  isAuthenticated,
  recruiters,
}: {
  company: Company;
  detail: CompanyDetail;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
  recruiters: CompanyRecruiter[];
}) {
  const initial = company.name.charAt(0).toUpperCase();
  const freshLabel = formatUpdated(company.updated_days_ago);
  const isFresh = company.updated_days_ago <= 30;

  return (
    <section style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      {/* Gradient cover band */}
      <div style={{ height: 200, background: company.gradient, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.32) 100%)" }} />
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -30, bottom: -80, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      </div>
      <div
        style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
        className="px-5 pb-7 md:px-12"
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-8)",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          {/* Left: logo + info */}
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
            {/* Logo — overlaps cover band */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 18,
                flexShrink: 0,
                marginTop: -56,
                position: "relative",
                zIndex: 1,
                background: company.gradient,
                border: "4px solid #fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 38,
                fontWeight: 700,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
                overflow: "hidden",
              }}
            >
              {company.logo_url ? (
                <CompanyLogoImage
                  logoUrl={company.logo_url}
                  name={company.name}
                  fallbackLetter={company.logo_letter ?? initial}
                  size={96}
                  gradient={company.gradient}
                />
              ) : (
                company.logo_letter ?? initial
              )}
            </div>
            <div style={{ paddingTop: "var(--space-3)" }}>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-mute)",
                  marginBottom: "var(--space-2)",
                  fontWeight: 700,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase" as const,
                  fontFamily: "Inter, var(--font-inter), sans-serif",
                }}
              >
                {company.industry}
              </div>
              {(() => {
                const enName = company.name_en
                  ? company.name_en
                      .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, '')
                      .replace(/\s+Co\.,?\s*Ltd\.?$/i, '')
                      .replace(/\s*,\s*Inc\.?$/i, '')
                      .replace(/\s+Inc\.?$/i, '')
                      .replace(/\s+Corp\.?$/i, '')
                      .trim() || null
                  : null;
                return (
                  <>
                    <h1
                      style={{
                        fontFamily: enName ? 'Inter, sans-serif' : 'var(--font-noto-serif)',
                        fontWeight: 800,
                        fontSize: "clamp(26px, 3vw, 40px)",
                        color: "var(--ink)",
                        marginBottom: enName ? "var(--space-1)" : "var(--space-2)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.18,
                      }}
                    >
                      {enName ?? company.name}
                    </h1>
                    {enName && (
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: "var(--space-2)", fontWeight: 400 }}>
                        {company.name}
                      </div>
                    )}
                  </>
                );
              })()}
              <p
                style={{
                  fontSize: "var(--text-md)",
                  color: "#1e293b",
                  lineHeight: 1.75,
                  letterSpacing: "0.01em",
                  marginBottom: "var(--space-4)",
                  maxWidth: 560,
                  fontWeight: 500,
                }}
              >
                {company.tagline}
              </p>
              {/* ジャンルチップ + フェーズバッジ */}
              {(company.genres.length > 0 || company.phase) && (
                <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
                  {company.genres.map((g) => (
                    <span
                      key={g.id}
                      style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "var(--space-1) var(--space-2)", borderRadius: 999,
                        fontSize: "var(--text-xs)", fontWeight: 700,
                        background: "var(--royal-50)",
                        color: "var(--royal)",
                        border: "1px solid var(--royal-100)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {g.name}
                    </span>
                  ))}
                  {company.phase && (() => {
                    const phaseStyle: Record<string, { bg: string; color: string; border: string }> = {
                      "上場": { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
                      "IPO準備": { bg: "#FFF7ED", color: "#C2410C", border: "#FDBA74" },
                      "シリーズC": { bg: "#F3E8FF", color: "#6D28D9", border: "#DDD6FE" },
                      "シリーズB": { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
                      "シリーズA": { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
                      "シード": { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" },
                    };
                    const s = phaseStyle[company.phase] ?? { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" };
                    return (
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "var(--space-1) var(--space-2)", borderRadius: 999,
                        fontSize: "var(--text-xs)", fontWeight: 700,
                        background: s.bg, color: s.color,
                        border: `1px solid ${s.border}`,
                        letterSpacing: "0.02em",
                      }}>
                        {company.phase}
                      </span>
                    );
                  })()}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {/* バッジ1: 従業員 */}
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                    padding: "var(--space-1) var(--space-3)",
                    background: "var(--bg-tint)",
                    color: "#334155",
                    border: "1px solid var(--line)",
                    borderRadius: 100,
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  {company.employee_count
                    ? (() => { const s = String(company.employee_count); return `従業員 ${s.includes("名") ? s : s + "名"}`; })()
                    : "従業員 —"}
                </span>
                {/* バッジ2: 創業 */}
                {(() => {
                  const year = parseInt(detail.established);
                  const age = !isNaN(year) ? new Date().getFullYear() - year : null;
                  return age !== null ? (
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                        padding: "var(--space-1) var(--space-3)",
                        background: "var(--bg-tint)",
                        color: "var(--ink-soft)",
                        border: "1px solid var(--line)",
                        borderRadius: 100,
                        fontSize: "var(--text-xs)",
                        fontWeight: 500,
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      創業 {age}年
                    </span>
                  ) : null;
                })()}
                {/* バッジ3: 採用中 */}
                {company.job_count > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      padding: "var(--space-1) var(--space-3)",
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      border: "1px solid #A7F3D0",
                      borderRadius: 100,
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--success)",
                        boxShadow: "0 0 6px rgba(5,150,105,0.6)",
                      }}
                    />
                    採用中 {company.job_count}件
                  </span>
                )}
                {/* バッジ4: 更新日 */}
                {isFresh && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      padding: "var(--space-1) var(--space-3)",
                      background: "var(--bg-tint)",
                      color: "var(--ink-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 100,
                      fontSize: "var(--text-xs)",
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--ink-soft)",
                      }}
                    />
                    {freshLabel}
                  </span>
                )}
              </div>

              {/* Perk keyword chips — work style highlights (max 4) */}
              {(() => {
                const chips: { icon: string; label: string }[] = [];
                // Remote/location
                if (detail.work_location.length > 0) {
                  const wl = detail.work_location[0].label;
                  const icon = wl.includes("リモート") || wl.includes("在宅") || wl.includes("テレワーク") ? "🏠" : "🏢";
                  chips.push({ icon, label: wl });
                }
                // Work style (flex, side job)
                for (const ws of detail.work_style) {
                  if (chips.length >= 4) break;
                  const icon = ws.label.includes("フレックス") ? "⏰"
                    : ws.label.includes("副業") ? "💼"
                    : ws.label.includes("裁量") ? "⚡"
                    : "✨";
                  chips.push({ icon, label: ws.label });
                }
                // Top benefits
                for (const b of (detail.benefits ?? [])) {
                  if (chips.length >= 4) break;
                  const icon = b.includes("ストックオプション") || b.includes("SO") ? "📈"
                    : b.includes("書籍") || b.includes("研修") ? "📚"
                    : b.includes("育休") || b.includes("産休") ? "👶"
                    : "✓";
                  chips.push({ icon, label: b.length > 12 ? b.slice(0, 12) + "…" : b });
                }
                if (chips.length === 0) return null;
                return (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "var(--space-3)" }}>
                    {chips.slice(0, 4).map(({ icon, label }) => (
                      <span
                        key={label}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                          padding: "var(--space-1) var(--space-2)",
                          background: "rgba(0,35,102,0.05)",
                          color: "var(--ink-soft)",
                          border: "1px solid rgba(0,35,102,0.1)",
                          borderRadius: 100,
                          fontSize: "var(--text-xs)",
                          fontWeight: 500,
                        }}
                      >
                        <span style={{ fontSize: "var(--text-xs)" }}>{icon}</span>
                        {label}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* SNS リンク */}
              {(company.x_url || company.linkedin_url || detail.url || company.careers_url) && (
                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
                  {company.x_url && (
                    <a href={company.x_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-1) var(--space-3)", borderRadius: 8, background: "#000", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      X (Twitter)
                    </a>
                  )}
                  {company.linkedin_url && (
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-1) var(--space-3)", borderRadius: 8, background: "#0A66C2", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                      LinkedIn
                    </a>
                  )}
                  {detail.url && (
                    <a href={detail.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-1) var(--space-3)", borderRadius: 8, background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      公式サイト
                    </a>
                  )}
                  {company.careers_url && (
                    <a href={company.careers_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-1) var(--space-3)", borderRadius: 8, background: "linear-gradient(135deg, var(--success-soft,#ECFDF5), #d1fae5)", color: "var(--success)", border: "1px solid #A7F3D0", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                      採用情報ページ
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: bookmark + compare */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignSelf: "flex-start", paddingTop: "var(--space-3)" }}>
            <BookmarkButton
              companyName={company.name}
              companyId={company.id}
              initialBookmarked={initialBookmarked}
              isAuthenticated={isAuthenticated}
            />
            <HeroCompareButton
              companyId={company.id}
              companyName={company.name}
              companyInitial={company.logo_letter ?? company.name.charAt(0).toUpperCase()}
              companyGradient={company.gradient}
            />
          </div>
        </div>

        {/* Stats strip — full-width grid */}
        {(() => {
          // 年収レンジを求人データから計算
          const allJobItems = detail.jobs.flatMap(c => c.items);
          const salaryMins = allJobItems.map(j => j.salaryMin).filter((v): v is number => v != null && v > 0);
          const salaryMaxs = allJobItems.map(j => j.salaryMax).filter((v): v is number => v != null && v > 0);
          const globalSalaryMin = salaryMins.length > 0 ? Math.min(...salaryMins) : null;
          const globalSalaryMax = salaryMaxs.length > 0 ? Math.max(...salaryMaxs) : null;
          const salaryRangeValue = globalSalaryMin && globalSalaryMax
            ? `${globalSalaryMin}〜${globalSalaryMax}万円`
            : globalSalaryMin ? `${globalSalaryMin}万円〜`
            : null;

          const stats = (
            [
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>,
                label: "社員数",
                value: company.employee_count ? (() => { const s = String(company.employee_count); return s.includes("名") ? s : s + "名以上"; })() : null,
                color: "var(--royal)",
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>,
                label: "事業ステージ",
                value: company.phase ?? null,
                color: "#7C3AED",
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
                label: "設立",
                value: detail.established || null,
                color: "var(--success)",
              },
              ...(salaryRangeValue ? [{
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                label: "想定年収",
                value: salaryRangeValue,
                color: "var(--success)",
              }] : []),
              ...(company.job_count > 0 ? [{
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>,
                label: "募集中の求人",
                value: `${company.job_count}件`,
                color: "#D97706",
              }] : []),
              ...(detail.numbers.fundingTotal ? [{
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                label: "累計調達",
                value: detail.numbers.fundingTotal,
                color: "#7C3AED",
              }] : []),
            ] as { icon: React.ReactNode; label: string; value: string | null; color: string }[]
          ).filter(s => s.value);
          if (stats.length === 0) return null;
          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
                paddingTop: "var(--space-4)",
                marginTop: "var(--space-4)",
                borderTop: "1px solid var(--line-soft)",
              }}
            >
              {stats.map(({ icon, label, value, color }, i) => (
                <div key={label} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "10px 0",
                  borderRight: i < stats.length - 1 ? "1px solid var(--line-soft)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color, flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 15, color: "var(--ink)", fontWeight: 700, fontFamily: "var(--font-noto-sans)" }}>{value}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Recruiter strip */}
        {recruiters.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            paddingTop: "var(--space-4)", marginTop: "var(--space-4)", borderTop: "1px solid var(--line-soft)",
          }}>
            <div style={{ display: "flex" }}>
              {recruiters.slice(0, 3).map((r, i) => (
                <div key={r.id} style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: r.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
                  border: "2.5px solid #fff",
                  marginLeft: i === 0 ? 0 : -10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: "var(--text-xs)", fontWeight: 700,
                  boxShadow: "0 0 0 1px var(--line)",
                  position: "relative", zIndex: 3 - i,
                }}>
                  {r.avatar_initial || (r.name ?? "採").charAt(0)}
                </div>
              ))}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)" }}>
              採用担当: <strong style={{ color: "var(--ink)" }}>{recruiters.slice(0, 2).map(r => r.name ?? "担当者").join(" · ")}</strong>
              {recruiters.length > 2 && ` 他${recruiters.length - 2}名`}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// TabsBar removed — replaced by CompanyStickyNav (scroll-spy version)

function SecTitle({
  icon,
  children,
  iconColor = "default",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  iconColor?: "default" | "green" | "purple" | "warm";
}) {
  const iconBg: Record<string, string> = {
    default: "var(--royal-50)",
    green: "var(--success-soft,#ECFDF5)",
    purple: "var(--purple-soft,#F3E8FF)",
    warm: "var(--warm-soft,#FEF3C7)",
  };
  const iconFg: Record<string, string> = {
    default: "var(--royal)",
    green: "var(--success)",
    purple: "var(--purple)",
    warm: "#B45309",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        fontFamily: 'var(--font-noto-serif)',
        fontWeight: 700,
        fontSize: "var(--text-lg)",
        color: "var(--ink)",
        letterSpacing: "0.01em",
        lineHeight: 1.3,
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: iconBg[iconColor],
          color: iconFg[iconColor],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: "var(--text-base)",
        }}
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function AboutSection({
  detail,
  photos,
}: {
  detail: CompanyDetail;
  photos: CompanyPhoto[];
}) {
  return (
    <section
      id="about"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header with subtle gradient */}
      <div style={{
        padding: "var(--space-6) var(--space-6) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
        >
          企業について
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-5) var(--space-6) var(--space-6)" }}>

        {/* MISSION — シンプル横帯 */}
        {detail.mission && (
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-5)",
            background: "#fafbff",
            borderRadius: 10,
            borderLeft: "3px solid var(--royal)",
            border: "1px solid var(--royal-100)",
            borderLeftWidth: 3,
            marginBottom: "var(--space-5)",
          }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "var(--royal)", textTransform: "uppercase" as const, flexShrink: 0 }}>
              MISSION
            </span>
            <span style={{ color: "var(--line)", fontSize: 14, flexShrink: 0 }}>|</span>
            <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(14px, 1.6vw, 17px)", fontWeight: 500, color: "var(--ink)", lineHeight: 1.6 }}>
              {detail.mission}
            </span>
          </div>
        )}

        {/* オフィス写真グリッド */}
        <PhotoCarousel photos={photos} />

        {/* ① 会社概要 — 全幅 */}
        {detail.about && (
          <p style={{ margin: "0 0 var(--space-5)", fontSize: "var(--text-base)", color: "var(--ink)", lineHeight: 1.9 }}>
            {detail.about}
          </p>
        )}

        {/* ② WHY JOIN */}
        {detail.why_join && (
          <div style={{
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--line)",
            borderLeft: "4px solid var(--royal)",
            padding: "20px 24px",
          }}>
            {/* 見出し */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--royal)", fontFamily: "var(--font-noto-sans)" }}>なぜこの会社に入るのか</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", opacity: 0.5, fontFamily: "Inter, sans-serif", textTransform: "uppercase" as const }}>WHY JOIN</span>
            </div>
            {/* 本文: 「。」区切りでポイント表示 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {detail.why_join.split(/。(?!\s*$)/).filter(s => s.trim()).map((sentence, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                    background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: "var(--royal)", fontFamily: "Inter",
                    marginTop: 2,
                  }}>{i + 1}</span>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--ink)", lineHeight: 1.85, fontFamily: "var(--font-noto-sans)" }}>
                    {sentence.trim()}。
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ③ CULTURE */}
        {detail.culture_description && (
          <div style={{
            borderRadius: 12,
            background: "#fffbeb",
            border: "1px solid #FDE68A",
            borderLeft: "4px solid #F59E0B",
            padding: "20px 24px",
          }}>
            {/* 見出し */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#92400E", fontFamily: "var(--font-noto-sans)" }}>組織文化・働く環境</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#D97706", opacity: 0.7, fontFamily: "Inter, sans-serif", textTransform: "uppercase" as const }}>CULTURE</span>
            </div>
            {/* キーワードを先に（一番目立つ場所） */}
            {detail.culture_keywords && detail.culture_keywords.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {detail.culture_keywords.map((kw, i) => (
                  <span key={i} style={{
                    fontSize: 13, padding: "5px 14px", borderRadius: 100,
                    background: "#FEF3C7", color: "#92400E",
                    border: "1.5px solid #FCD34D", fontWeight: 700,
                    fontFamily: "var(--font-noto-sans)",
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
            {/* 説明テキスト（キーワードの補足として下に） */}
            <p style={{ margin: 0, fontSize: 13, color: "#78350F", lineHeight: 1.85, fontFamily: "var(--font-noto-sans)" }}>
              {detail.culture_description}
            </p>
          </div>
        )}

        {/* ④ 会社の特徴・強み */}
        {detail.company_features && detail.company_features.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {/* セクション区切り見出し */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
                letterSpacing: "0.1em", fontFamily: "var(--font-noto-sans)",
                textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
              }}>会社の特徴・強み</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {detail.company_features.map((f, i) => (
                <span key={i} style={{
                  padding: "5px 14px", borderRadius: 6,
                  background: "var(--bg-tint)", border: "1px solid var(--line)",
                  fontSize: 13, fontWeight: 600, color: "var(--ink-soft)",
                  fontFamily: "var(--font-noto-sans)",
                }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

// ─── ProductsCultureSection ────────────────────────────────────────────────────

// ─── ProductsClientsSection ───────────────────────────────────────────────────

/** 製品名から（...）形式のサブタイトルを分離する */
function parseProductName(raw: string): { name: string; sub: string | null } {
  const m = raw.match(/^(.+?)（(.+?)）\s*$/);
  if (m) return { name: m[1].trim(), sub: m[2].trim() };
  const m2 = raw.match(/^(.+?)\((.+?)\)\s*$/);
  if (m2) return { name: m2[1].trim(), sub: m2[2].trim() };
  return { name: raw, sub: null };
}

/** キーワードベースで製品カードのアイコン＋カラーを決める */
function productStyle(name: string): { bg: string; border: string; color: string; icon: React.ReactNode } {
  const n = name.toLowerCase();
  // CRM / Sales
  if (/(crm|sales|営業|セールス)/.test(n))
    return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> };
  // Marketing
  if (/(market|マーケ|メール|email)/.test(n))
    return { bg: "#fdf4ff", border: "#e9d5ff", color: "#7c3aed",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> };
  // Analytics / Data
  if (/(analytic|data|分析|レポ|insight|tableau|bi)/.test(n))
    return { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> };
  // Service / Support
  if (/(service|support|サービス|サポート|cs|カスタマ)/.test(n))
    return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> };
  // Platform / Cloud
  if (/(platform|cloud|クラウド|プラットフォーム)/.test(n))
    return { bg: "#f0f9ff", border: "#bae6fd", color: "#0369a1",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg> };
  // AI / ML
  if (/(ai|ml|機械学習|人工知能|llm|gpt)/.test(n))
    return { bg: "#faf5ff", border: "#ddd6fe", color: "#6d28d9",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> };
  // HR / People
  if (/(hr|human|採用|人事|タレント|talent)/.test(n))
    return { bg: "#fef9c3", border: "#fef08a", color: "#854d0e",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg> };
  // Default
  return { bg: "#f8fafc", border: "var(--line)", color: "var(--ink-soft)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> };
}

function ProductsClientsSection({ detail }: { detail: CompanyDetail }) {
  const hasProducts = detail.main_products && detail.main_products.length > 0;
  const hasCases = detail.customer_cases && detail.customer_cases.length > 0;
  const hasCustomers = detail.main_customers && detail.main_customers.length > 0;

  if (!hasProducts && !hasCases && !hasCustomers) return null;

  return (
    <section
      id="products-clients"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{ padding: "var(--space-6) var(--space-6) var(--space-4)", background: "#f5f8ff", borderBottom: "1px solid #dde4f5" }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          }
        >
          製品・顧客
        </SecTitle>
      </div>

      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

        {/* ── 製品・サービス ── */}
        {hasProducts && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--royal)", fontFamily: "var(--font-noto-sans)", letterSpacing: "0.02em" }}>
                主な製品・サービス
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                {detail.main_products!.length} 製品
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "var(--space-2)",
            }}>
              {detail.main_products!.map((raw, i) => {
                const { name, sub } = parseProductName(raw);
                const s = productStyle(name);
                return (
                  <div
                    key={i}
                    style={{
                      background: s.bg,
                      border: `1px solid ${s.border}`,
                      borderRadius: 10,
                      padding: "10px var(--space-4)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    {/* アイコン */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: s.border, color: s.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {s.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, fontFamily: "var(--font-noto-sans)" }}>
                        {name}
                      </p>
                      {sub && (
                        <p style={{ margin: "3px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-soft)", fontWeight: 500, lineHeight: 1.4 }}>
                          {sub}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── リッチ導入事例カード ── */}
        {hasCases && (
          <div>
            {hasProducts && <div style={{ height: 1, background: "var(--line)", marginBottom: "var(--space-6)", marginTop: -4 }} />}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth={2.5} strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#B45309", fontFamily: "var(--font-noto-sans)", letterSpacing: "0.02em" }}>
                主な導入事例
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                {detail.customer_cases!.length} 社
              </span>
            </div>
            <CustomerCasesClient cases={detail.customer_cases!} />
          </div>
        )}

        {/* ── 顧客タグ（customer_cases がない場合のフォールバック） ── */}
        {!hasCases && hasCustomers && (
          <div>
            {hasProducts && <div style={{ height: 1, background: "var(--line)", marginBottom: "var(--space-6)", marginTop: -8 }} />}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth={2.5} strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#B45309", fontFamily: "var(--font-noto-sans)", letterSpacing: "0.02em" }}>
                主な顧客
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                {detail.main_customers!.length} 社
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {detail.main_customers!.map((c, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 14px",
                    borderRadius: 100,
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "#92400E",
                    fontFamily: "var(--font-noto-sans)",
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ fontSize: 10, opacity: 0.7 }}>🏢</span>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


// ─── Benefits Section ─────────────────────────────────────────────────────────

function BenefitsSection({ detail }: { detail: CompanyDetail }) {
  const SUBHEADER_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-noto-sans)",
    fontSize: "var(--text-sm)",
    fontWeight: 700,
    color: "#334155",
    marginBottom: "var(--space-3)",
    letterSpacing: "0.02em",
  };
  // UNSET_STYLE removed — replaced by inline "カジュアル面談でご確認ください" badges

  const hasBenefits = !!(detail.benefits && detail.benefits.length > 0);
  const hasEvaluation = !!detail.evaluationSystem;
  if (!hasBenefits && !hasEvaluation) return null;

  return (
    <section
      id="benefits"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--space-6) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        >
          福利厚生・評価制度
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>

      {/* ── 福利厚生 ── */}
      {/* Benefit keyword → emoji mapping */}
      {(() => {
        const BENEFIT_ICONS: Record<string, string> = {
          "フルリモート": "🏠", "リモート": "🏠", "在宅": "🏠", "テレワーク": "🏠",
          "フレックス": "🕐", "フレックスタイム": "🕐", "時差出勤": "🕐",
          "副業": "💼", "兼業": "💼",
          "ストックオプション": "📈", "SO": "📈", "持株": "📈",
          "書籍": "📚", "学習": "📚", "研修": "📚", "勉強会": "📚", "資格": "📚",
          "育休": "👶", "産休": "👶", "子育て": "👶", "保育": "👶",
          "健康保険": "🏥", "医療": "🏥", "保険": "🏥",
          "交通費": "🚃", "定期代": "🚃",
          "食事": "🍱", "ランチ": "🍱", "社食": "🍱",
          "休暇": "🌴", "有給": "🌴", "休日": "🌴",
          "家賃": "🏢", "住宅": "🏢", "社宅": "🏢",
          "ペット": "🐾",
          "英語": "🌐", "語学": "🌐", "海外": "🌐",
          "マッサージ": "💆", "スポーツ": "🏃", "ジム": "🏃",
          "社員旅行": "✈️",
          "慶弔": "🎊",
          "確定拠出": "💰", "退職金": "💰",
        };
        function getBenefitIcon(benefit: string): string {
          for (const [kw, icon] of Object.entries(BENEFIT_ICONS)) {
            if (benefit.includes(kw)) return icon;
          }
          return "✓";
        }
        return (
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={SUBHEADER_STYLE}>福利厚生</div>
        {detail.benefits && detail.benefits.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {detail.benefits.map((b) => (
              <span
                key={b}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  background: "var(--royal-50)",
                  border: "1px solid var(--royal-100)",
                  borderRadius: 100,
                  fontSize: "var(--text-sm)",
                  color: "var(--royal)",
                  fontWeight: 500,
                }}
              >
                <span style={{ fontSize: "var(--text-base)", lineHeight: 1 }}>{getBenefitIcon(b)}</span>
                {b}
              </span>
            ))}
          </div>
        ) : (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            fontSize: "var(--text-xs)", color: "var(--ink-soft)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            カジュアル面談でご確認ください
          </div>
        )}
      </div>
        );
      })()}

      {/* ── 評価制度 ── */}
      <div>
        <div style={SUBHEADER_STYLE}>評価制度</div>
        {detail.evaluationSystem ? (
          <EvaluationText text={detail.evaluationSystem} />
        ) : (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            fontSize: "var(--text-xs)", color: "var(--ink-soft)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            カジュアル面談でご確認ください
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

// ─── Employee Voices Section ─────────────────────────────────────────────────

function EmployeeVoicesSection({ employees }: { employees: CompanyEmployee[] }) {
  const voices = employees.filter(e => e.catchphrase && e.catchphrase.trim().length > 0);
  if (voices.length === 0) return null;

  return (
    <section
      id="voices"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{ padding: "var(--space-6) var(--space-6) var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
        <SecTitle
          iconColor="purple"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          }
        >
          社員の声
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", fontWeight: 400, fontFamily: "Inter, sans-serif", marginLeft: "var(--space-2)" }}>
            {voices.length}名
          </span>
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
        <style>{`
          .voices-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-4);
          }
          @media (max-width: 767px) {
            .voices-grid { grid-template-columns: 1fr; }
          }
        `}</style>
        <div className="voices-grid">
          {voices.slice(0, 6).map((emp) => {
            const avatarColor = resolveAvatarColor(emp.roleParentId, emp.roleCategoryId);
            return (
              <a
                key={emp.userId}
                href={`/u/${emp.userId}`}
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  padding: "var(--space-4)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  background: "var(--bg-tint)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
                className="voice-card"
                >
                  {/* Quote text */}
                  <div style={{ position: "relative", flex: 1 }}>
                    <svg
                      width="22" height="22" viewBox="0 0 24 24" fill="var(--purple-soft,#F3E8FF)"
                      style={{ position: "absolute", top: -4, left: -4, opacity: 0.8 }}
                    >
                      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
                      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
                    </svg>
                    <p style={{
                      margin: 0,
                      paddingLeft: 20,
                      fontSize: "var(--text-sm)",
                      color: "var(--ink)",
                      lineHeight: 1.75,
                      fontWeight: 500,
                    }}>
                      {emp.catchphrase}
                    </p>
                  </div>
                  {/* Attribution */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", borderTop: "1px solid var(--line-soft)", paddingTop: "var(--space-2)" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: emp.avatarUrl ? undefined : avatarColor.bg,
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 13, color: avatarColor.text,
                      overflow: "hidden", border: "1.5px solid var(--line)",
                    }}>
                      {emp.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={emp.avatarUrl} alt={emp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : emp.avatarInitial}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {emp.name}
                      </div>
                      {emp.roleTitle && (
                        <div style={{ fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {emp.roleTitle}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Employee Sections ────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  showEndedAt,
}: {
  employee: CompanyEmployee;
  showEndedAt?: boolean;
}) {
  // γ-3 修正②: 職種カテゴリ（親カテゴリ優先）でアバター色を統一
  const avatarColor = resolveAvatarColor(employee.roleParentId, employee.roleCategoryId);

  const avatar = (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: employee.avatarUrl ? undefined : avatarColor.bg,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-noto-serif)",
        fontWeight: 700,
        fontSize: 19,
        color: avatarColor.text,
        overflow: "hidden",
        border: "2px solid var(--line)",
      }}
    >
      {employee.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={employee.avatarUrl}
          alt={employee.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        employee.avatarInitial
      )}
    </div>
  );

  const nameAndRole = (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>
          {employee.name}
        </span>
      </div>
      {employee.roleTitle && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-xs)",
            color: "var(--ink-soft)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {employee.roleTitle}
        </p>
      )}
      {employee.catchphrase && (
        <p
          style={{
            margin: "5px 0 0",
            fontSize: "var(--text-xs)",
            color: "var(--ink-soft)",
            lineHeight: 1.55,
            borderLeft: "2px solid var(--royal-100)",
            paddingLeft: 7,
          }}
        >
          {employee.catchphrase}
        </p>
      )}
      {showEndedAt && employee.endedAt && (
        <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-soft)", marginTop: 2 }}>
          退職: {employee.endedAt}
        </p>
      )}
    </div>
  );

  return (
    <a
      href={`/u/${employee.userId}`}
      className="employee-card-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) 14px",
        background: "var(--bg-tint)",
        border: employee.canCasualMeeting ? "1px solid rgba(245,158,11,0.35)" : "1px solid var(--line)",
        borderRadius: 12,
        textDecoration: "none",
      }}
    >
      {avatar}
      {nameAndRole}
      {/* カジュアル面談受付中の人だけボタン表示 */}
      {employee.canCasualMeeting && (
        <span style={{
          flexShrink: 0,
          fontSize: 10.5, fontWeight: 700,
          padding: "4px 10px", borderRadius: 100,
          background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
          color: "#92400E",
          border: "1px solid #FCD34D",
          whiteSpace: "nowrap",
        }}>
          話を聞ける
        </span>
      )}
    </a>
  );
}

// employee-grid: 均等2列 (md以上) / 3列 (xl以上) — CSS classで定義
const EMPLOYEE_GRID_CSS = `
  .employee-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  @media (max-width: 767px) {
    .employee-grid { grid-template-columns: 1fr; }
  }
  @media (min-width: 1280px) {
    .employee-grid { grid-template-columns: repeat(3, 1fr); }
  }
`;


function CurrentEmployeesSection({
  employees,
  categories,
  alumniCount = 0,
}: {
  employees: CompanyEmployee[];
  categories: CompanyEmployeeCategoryItem[];
  alumniCount?: number;
}) {
  // 現役社員0名のときはセクションを描画しない（0という数値を見せない）
  if (employees.length === 0) {
    // OB/OGがいる場合は導線を表示
    if (alumniCount > 0) {
      return (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "var(--space-6)",
        }}>
          <p style={{ fontSize: "var(--text-base)", color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>OB/OGのプロフィールを準備中。</span>
            &nbsp;<strong style={{ color: "var(--royal)" }}>{alumniCount}名</strong>のキャリア情報を近日公開予定です。
          </p>
        </section>
      );
    }
    return null;
  }

  // ── カテゴリ別社員マップ (roleId → employees) ──────────────────────────────
  const empsByCategory = new Map<string, CompanyEmployee[]>();
  for (const emp of employees) {
    if (!emp.roleCategoryId) continue;
    // 既存: 子UUID（または子なし親UUID）→ 社員
    if (!empsByCategory.has(emp.roleCategoryId)) empsByCategory.set(emp.roleCategoryId, []);
    empsByCategory.get(emp.roleCategoryId)!.push(emp);
    // 追加: 親UUID → 社員（親カテゴリ登録時の集約用）
    if (emp.roleParentId) {
      if (!empsByCategory.has(emp.roleParentId)) empsByCategory.set(emp.roleParentId, []);
      empsByCategory.get(emp.roleParentId)!.push(emp);
    }
  }

  // ── 親グループ化 (display_order 順を保持) ─────────────────────────────────
  type Group = {
    groupKey: string;
    parentName: string;
    isParentDirect: boolean; // parent_id が null = 親直カテゴリ
    children: CompanyEmployeeCategoryItem[];
  };
  const groups: Group[] = [];
  const groupMap = new Map<string, Group>();
  for (const cat of categories) {
    const groupKey = cat.parentId ?? cat.roleId;
    if (!groupMap.has(groupKey)) {
      const g: Group = {
        groupKey,
        parentName: cat.parentId ? (cat.parentName ?? cat.roleName) : cat.roleName,
        isParentDirect: !cat.parentId,
        children: [],
      };
      groups.push(g);
      groupMap.set(groupKey, g);
    }
    groupMap.get(groupKey)!.children.push(cat);
  }

  // カテゴリ未割り当て社員 (roleCategoryId が null の場合)
  const uncategorized = employees.filter((e) => !e.roleCategoryId);

  const SECTION_ICON = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  return (
    <>
    <style>{EMPLOYEE_GRID_CSS}</style>
    <section
      id="current-employees"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--space-6) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle icon={SECTION_ICON}>
          現役社員
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "var(--text-sm)",
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: "var(--space-2)",
            }}
          >
            ({employees.length}名)
          </span>
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
      {/* ── Role composition bar (3名以上 + カテゴリあり) ───────────────────── */}
      {employees.length >= 3 && categories.length > 0 && (() => {
        const catCounts = new Map<string, number>();
        for (const emp of employees) {
          const label = emp.roleParentName ?? emp.roleCategoryName ?? "その他";
          catCounts.set(label, (catCounts.get(label) ?? 0) + 1);
        }
        const entries = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]);
        const total = employees.length;
        const COLORS = ["var(--royal)", "#3B5FD9", "#7C3AED", "var(--success)", "#F59E0B", "#DC2626", "#6b7280"];
        return (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", height: 8, borderRadius: 100, overflow: "hidden", marginBottom: "var(--space-2)", gap: 2 }}>
              {entries.map(([name, count], i) => (
                <div
                  key={name}
                  title={`${name}: ${count}名 (${Math.round((count / total) * 100)}%)`}
                  style={{
                    flex: `${count} 0 0`,
                    background: COLORS[i % COLORS.length],
                    borderRadius: 100,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 16px" }}>
              {entries.map(([name, count], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ink-soft)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0, display: "inline-block" }} />
                  {name}
                  <span style={{ fontWeight: 700, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{count}</span>名
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {employees.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "32px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--royal-50)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--ink-soft)" }}>
            社員プロフィールを準備中
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            OPINIO 取材メンバーが順次公開されます。<br />
            カジュアル面談で直接チームの声を聞けます。
          </div>
        </div>
      ) : categories.length === 0 ? (
        // カテゴリ設定なし → レスポンシブ列
        <div className="employee-grid">
          {employees.map((emp) => (
            <EmployeeCard key={emp.userId} employee={emp} />
          ))}
        </div>
      ) : (
        // カテゴリ設定あり → 階層表示
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {groups.map((group) => {
            const totalInGroup = group.children.reduce(
              (sum, cat) => sum + (empsByCategory.get(cat.roleId)?.length ?? 0),
              0
            );
            if (totalInGroup === 0) return null; // 0 名カテゴリは非表示

            return (
              <div key={group.groupKey}>
                {/* 親カテゴリ見出し */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    marginBottom: "var(--space-3)",
                    paddingBottom: "var(--space-2)",
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)" }}>
                    {group.parentName}
                  </span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "var(--text-xs)",
                      fontWeight: 400,
                      color: "var(--ink-mute)",
                    }}
                  >
                    {totalInGroup}名
                  </span>
                </div>

                {group.isParentDirect ? (
                  // 親直: 子見出しなしでグリッドを直接表示
                  <div className="employee-grid">
                    {(empsByCategory.get(group.children[0].roleId) ?? []).map((emp) => (
                      <EmployeeCard key={emp.userId} employee={emp} />
                    ))}
                  </div>
                ) : (
                  // 子カテゴリあり: 子見出し + グリッド
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {group.children.map((cat) => {
                      const empsInCat = empsByCategory.get(cat.roleId) ?? [];
                      if (empsInCat.length === 0) return null;
                      return (
                        <div key={cat.roleId}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 5,
                              marginBottom: "var(--space-2)",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                fontWeight: 600,
                                color: "var(--ink-soft)",
                              }}
                            >
                              {cat.roleName}
                            </span>
                            <span
                              style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: "var(--text-xs)",
                                fontWeight: 400,
                                color: "var(--ink-mute)",
                              }}
                            >
                              {empsInCat.length}名
                            </span>
                          </div>
                          <div className="employee-grid">
                            {empsInCat.map((emp) => (
                              <EmployeeCard key={emp.userId} employee={emp} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* カテゴリ未割り当て社員 */}
          {uncategorized.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: "var(--space-3)",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                その他
              </div>
              <div className="employee-grid">
                {uncategorized.map((emp) => (
                  <EmployeeCard key={emp.userId} employee={emp} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </section>
    </>
  );
}

// ─── AlumniCard ──────────────────────────────────────────────────────────────

function AlumniCard({ employee }: { employee: CompanyEmployee }) {
  const avatarColor = resolveAvatarColor(employee.roleParentId, employee.roleCategoryId);

  // 在籍期間を計算（"YYYY-MM" 形式）
  function calcTenure(startedAt: string | null, endedAt: string | null): string | null {
    if (!startedAt || !endedAt) return null;
    const [sy, sm] = startedAt.split("-").map(Number);
    const [ey, em] = endedAt.split("-").map(Number);
    const months = (ey - sy) * 12 + (em - sm);
    if (months <= 0) return null;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem}ヶ月`;
    if (rem === 0) return `${years}年`;
    return `${years}年${rem}ヶ月`;
  }

  const tenure = calcTenure(employee.startedAt, employee.endedAt);
  const period = employee.startedAt && employee.endedAt
    ? `${employee.startedAt.slice(0, 7).replace("-", ".")} 〜 ${employee.endedAt.replace("-", ".")}`
    : employee.endedAt ? `〜 ${employee.endedAt.replace("-", ".")} 退職` : null;

  return (
    <a
      href={`/u/${employee.userId}`}
      className="employee-card-link"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 16px",
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        textDecoration: "none",
      }}
    >
      {/* 上段: アバター + 名前・役職 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: employee.avatarUrl ? undefined : avatarColor.bg,
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 19,
          color: avatarColor.text, overflow: "hidden", border: "2px solid var(--line)",
        }}>
          {employee.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.avatarUrl} alt={employee.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : employee.avatarInitial}
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)" }}>
            {employee.name}
          </span>
          {employee.roleTitle && (
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {employee.roleTitle}
            </p>
          )}
          {/* 在籍期間 */}
          {(period || tenure) && (
            <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
              {period && <span>{period}</span>}
              {tenure && (
                <span style={{ background: "var(--royal-50)", color: "var(--royal)", padding: "1px 6px", borderRadius: 100, fontWeight: 600, fontSize: 10 }}>
                  {tenure}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* 下段: 現在のキャリア */}
      {(employee.currentCompanyName || employee.currentRoleTitle) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 8,
          background: "#fff", border: "1px solid var(--line-soft)",
          fontSize: 11,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span style={{ color: "var(--ink-mute)", flexShrink: 0 }}>現在:</span>
          <span style={{ color: "var(--ink-soft)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {employee.currentCompanyName ?? ""}{employee.currentRoleTitle ? ` · ${employee.currentRoleTitle}` : ""}
          </span>
        </div>
      )}
    </a>
  );
}

function AlumniSection({ alumni }: { alumni: CompanyEmployee[] }) {
  return (
    <section
      id="alumni"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--space-6) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        >
          OB・OG社員
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "var(--text-sm)",
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: "var(--space-2)",
            }}
          >
            ({alumni.length}名)
          </span>
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
      {alumni.length > 0 ? (
        <>
          <div className="employee-grid">
            {alumni.map((emp) => (
              <AlumniCard key={emp.userId} employee={emp} />
            ))}
          </div>
        </>
      ) : (
        <div style={{
          textAlign: "center", padding: "24px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--royal-50)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", lineHeight: 1.7 }}>
            OB・OG情報は順次更新されます
          </div>
        </div>
      )}
      </div>
    </section>
  );
}

function JobsSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  // ── 0 件 ────────────────────────────────────────────────────────────────────
  if (detail.jobs.length === 0) {
    return (
      <section
        id="jobs"
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: "var(--space-6)",
          boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
        }}
      >
        <div style={{ padding: "var(--space-6) var(--space-6) var(--space-4)", borderBottom: "1px solid var(--line-soft)", background: "linear-gradient(180deg, #fafbff 0%, #fff 100%)" }}>
          <SecTitle
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 10h18" />
              </svg>
            }
          >
            募集中の求人
          </SecTitle>
        </div>
        <div style={{ padding: "var(--space-6)" }}>
          <p style={{ fontSize: "var(--text-base)", color: "var(--ink-soft)", textAlign: "center", padding: "24px 0", margin: 0 }}>
            現在、公開中の求人はありません。
          </p>
        </div>
      </section>
    );
  }

  // γ-4 修正③: 求人合計件数で表示モードを切り替え
  const totalJobs = detail.jobs.reduce((sum, cat) => sum + cat.total, 0);

  // 求人アコーディオンラッパー
  const defaultWorkLocation = detail.work_location.length > 0 ? detail.work_location[0].label : "";

  const sectionIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );

  return (
    <section
      id="jobs"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--space-6) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-2)",
      }}>
        <SecTitle icon={sectionIcon}>
          募集中の求人
          <span style={{ fontSize: "var(--text-xs)", color: "var(--royal)", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
            · {company.job_count}件
          </span>
        </SecTitle>
        <Link
          href={`/companies/${company.id}/jobs`}
          style={{ color: "var(--royal)", fontSize: "var(--text-sm)", fontWeight: 500, textDecoration: "none" }}
        >
          すべての求人を見る →
        </Link>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
      {totalJobs < JOB_GROUPING_THRESHOLD ? (
        // ── 1〜3 件: カテゴリヘッダーなし、直接リスト (γ-4 修正③) ──────────
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {detail.jobs.flatMap((cat, ci) =>
            cat.items.map((job, ji) => (
              <JobAccordionItem
                key={job.id ?? `${ci}-${ji}`}
                job={job}
                catName={cat.cat}
                catId={cat.catId}
                companyId={company.id}
                defaultWorkLocation={defaultWorkLocation}
              />
            ))
          )}
        </div>
      ) : (
        // ── 4 件以上: カテゴリグルーピング表示 (既存構造を維持) ────────────
        <>
          {detail.jobs.map((cat) => (
            <div key={cat.cat} style={{ marginBottom: "var(--space-6)" }}>
              {/* カテゴリヘッダー (既存スタイル維持) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-3)",
                  padding: "var(--space-2) var(--space-4)",
                  background: "var(--royal-50)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-base)", fontWeight: 700, color: "var(--royal)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  {cat.cat}
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "var(--text-xs)",
                      color: "var(--royal)",
                      background: "#fff",
                      padding: "2px 10px",
                      borderRadius: 100,
                      fontWeight: 700,
                    }}
                  >
                    {cat.total}件
                  </span>
                </div>
                {cat.total > 4 && (
                  <Link
                    href={cat.catId ? `/jobs?company=${company.id}&category=${cat.catId}` : `/jobs?company=${company.id}`}
                    style={{ fontSize: "var(--text-xs)", color: "var(--royal)", fontWeight: 500, textDecoration: "none" }}
                  >
                    すべて見る →
                  </Link>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {cat.items.slice(0, 4).map((job, i) => (
                  <JobAccordionItem
                    key={job.id ?? i}
                    job={job}
                    catName={cat.cat}
                    catId={cat.catId}
                    companyId={company.id}
                    defaultWorkLocation={defaultWorkLocation}
                  />
                ))}
              </div>
            </div>
          ))}

          <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
            <Link
              href={`/companies/${company.id}/jobs`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-2) var(--space-6)",
                background: "#fff",
                color: "var(--royal)",
                border: "1.5px solid var(--royal)",
                borderRadius: 8,
                fontSize: "var(--text-base)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {company.job_count}件すべての求人を見る →
            </Link>
          </div>
        </>
      )}

      {/* CTA: 求人に迷ったらカジュアル面談 */}
      {company.jobs_public && (
        <div style={{
          marginTop: "var(--space-5)",
          padding: "var(--space-4) var(--space-5)",
          borderRadius: 12,
          background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
          border: "1px solid #FCD34D",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
              気になる求人があったら、まず話を聞いてみませんか？
            </div>
            <div style={{ fontSize: 12, color: "#B45309" }}>
              カジュアル面談は完全無料・選考なし。転職意欲がなくても参加できます。
            </div>
          </div>
          <Link
            href={`/companies/${company.id}/casual-meeting`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "10px 20px", borderRadius: 8, fontSize: "var(--text-sm)", fontWeight: 700,
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff", textDecoration: "none", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(245,158,11,0.35)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            担当者に相談する
          </Link>
        </div>
      )}
      </div>
    </section>
  );
}

const AV_GRADIENTS = [
  "linear-gradient(135deg, var(--royal), #3B5FD9)",
  "linear-gradient(135deg, #F472B6, #DB2777)",
  "linear-gradient(135deg, #34D399, var(--success))",
  "linear-gradient(135deg, #FBBF24, #D97706)",
  "linear-gradient(135deg, #818CF8, #6366F1)",
  "linear-gradient(135deg, #A78BFA, #7C3AED)",
  "linear-gradient(135deg, #22D3EE, #0891B2)",
];

function RecruitersSection({
  recruiters,
}: {
  recruiters: CompanyRecruiter[];
}) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--space-6) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          iconColor="green"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          }
        >
          採用担当者
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-3)",
        }}
        className="[grid-template-columns:repeat(2,1fr)] sm:[grid-template-columns:repeat(3,1fr)]"
      >
        {recruiters.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              gap: "var(--space-3)",
              padding: "var(--space-4)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "#fff",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                flexShrink: 0,
                background: r.avatar_color ?? AV_GRADIENTS[i % AV_GRADIENTS.length],
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: "var(--text-lg)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              {r.avatar_initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.name}
              </div>
              {r.role_title && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.role_title}
                </div>
              )}
              {r.department && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.department}
                </div>
              )}
              {r.catchphrase && (
                <p style={{
                  margin: "5px 0 0",
                  fontSize: "var(--text-xs)",
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                  borderLeft: "2px solid var(--warm)",
                  paddingLeft: 7,
                  fontStyle: "italic",
                }}>
                  &ldquo;{r.catchphrase}&rdquo;
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "var(--space-4)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--bg-tint)",
          borderRadius: 8,
          fontSize: "var(--text-xs)",
          color: "var(--ink-soft)",
          lineHeight: 1.7,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        カジュアル面談を申し込むと、上記担当者から連絡が届きます。
      </div>
      </div>
    </section>
  );
}

// ─── Company Phase Timeline ──────────────────────────────────────────────────

function CompanyPhaseTimeline({ company, detail }: { company: Company; detail: CompanyDetail }) {
  const foundedYear = (() => {
    const raw = detail.established;
    if (!raw) return null;
    const m = raw.match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const currentYear = new Date().getFullYear();
  const phase = company.phase ?? null;
  if (!phase && !foundedYear) return null;

  const PHASE_STYLES: Record<string, { bg: string; border: string; color: string; dot: string }> = {
    "シード":        { bg: "#F1F5F9", border: "#CBD5E1", color: "#475569", dot: "#94A3B8" },
    "シリーズA":     { bg: "#ECFDF5", border: "#A7F3D0", color: "#065F46", dot: "#059669" },
    "シリーズB":     { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8", dot: "#3B82F6" },
    "シリーズC":     { bg: "#F3E8FF", border: "#DDD6FE", color: "#6D28D9", dot: "#7C3AED" },
    "シリーズD以降": { bg: "#FFF7ED", border: "#FDBA74", color: "#C2410C", dot: "#F97316" },
    "IPO準備":       { bg: "#FFF7ED", border: "#FDBA74", color: "#C2410C", dot: "#F97316" },
  };
  const LISTED_STYLES = { bg: "#FEF3C7", border: "#FDE68A", color: "#92400E", dot: "#F59E0B" };

  function isListed(p: string): boolean {
    return p.includes("上場") || p.includes("listed") || p.startsWith("東証") || p.includes("NYSE") || p.includes("NASDAQ");
  }
  const PHASE_ORDER = ["シード", "シリーズA", "シリーズB", "シリーズC", "シリーズD以降", "IPO準備", "上場"];
  function phaseIndex(p: string | null): number {
    if (!p) return -1;
    if (isListed(p)) return 6;
    return PHASE_ORDER.findIndex((x) => p.startsWith(x) || p === x);
  }

  type Milestone = { icon: string; title: string; sub: string; isCurrent: boolean; color: string; bgColor: string; borderColor: string; };
  const milestones: Milestone[] = [];

  if (foundedYear) milestones.push({ icon: "🏢", title: "創業", sub: `${foundedYear}年`, isCurrent: false, color: "var(--ink-soft)", bgColor: "var(--bg-tint)", borderColor: "var(--line)" });

  if (phase && foundedYear) {
    const ci = phaseIndex(phase);
    if (ci >= 2 && !phase.startsWith("シリーズA")) { const s = PHASE_STYLES["シリーズA"]; milestones.push({ icon: "📈", title: "シリーズA", sub: "資金調達", isCurrent: false, color: s.color, bgColor: s.bg, borderColor: s.border }); }
    if (ci >= 3 && !phase.startsWith("シリーズB")) { const s = PHASE_STYLES["シリーズB"]; milestones.push({ icon: "📈", title: "シリーズB", sub: "資金調達", isCurrent: false, color: s.color, bgColor: s.bg, borderColor: s.border }); }
  }

  if (phase) {
    const listed = isListed(phase);
    const s = listed ? LISTED_STYLES : (PHASE_STYLES[phase] ?? { bg: "#F1F5F9", border: "#CBD5E1", color: "#475569", dot: "#94A3B8" });
    milestones.push({ icon: listed ? "🎉" : phaseIndex(phase) <= 1 ? "🌱" : "📈", title: listed ? (phase.replace("上場","").trim() || "上場") : phase, sub: listed ? (foundedYear ? `${foundedYear}年〜` : "上場企業") : "現在のフェーズ", isCurrent: true, color: s.color, bgColor: s.bg, borderColor: s.border });
  }

  if (company.employee_count) milestones.push({ icon: "👥", title: "現在の規模", sub: String(company.employee_count).includes("名") ? String(company.employee_count) : `${company.employee_count}名+`, isCurrent: false, color: "var(--royal)", bgColor: "var(--royal-50)", borderColor: "var(--royal-100)" });

  if (foundedYear && milestones.length >= 2 && currentYear - foundedYear > 0) {
    milestones.push({ icon: "🕐", title: `創業${currentYear - foundedYear}年目`, sub: `${currentYear}年現在`, isCurrent: false, color: "var(--ink-mute)", bgColor: "var(--bg-tint)", borderColor: "var(--line)" });
  }

  if (milestones.length < 2) return null;

  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", marginBottom: "var(--space-6)", boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)" }}>
      <div style={{ padding: "var(--space-6) var(--space-6) var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}>成長フェーズ</SecTitle>
      </div>
      <div style={{ padding: "var(--space-5) var(--space-6) var(--space-6)" }}>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "flex-start", minWidth: "max-content" }}>
            {milestones.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 110, gap: 6 }}>
                  <div style={{ width: m.isCurrent ? 44 : 36, height: m.isCurrent ? 44 : 36, borderRadius: "50%", background: m.bgColor, border: `2px solid ${m.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: m.isCurrent ? 18 : 15, boxShadow: m.isCurrent ? `0 0 0 4px ${m.bgColor}` : "none", flexShrink: 0 }}>{m.icon}</div>
                  <div style={{ fontSize: m.isCurrent ? 12 : 11, fontWeight: m.isCurrent ? 800 : 600, color: m.isCurrent ? m.color : "var(--ink)", textAlign: "center", lineHeight: 1.25 }}>{m.title}</div>
                  <div style={{ fontSize: 10, color: m.isCurrent ? m.color : "var(--ink-mute)", textAlign: "center", lineHeight: 1.3, fontFamily: "Inter, sans-serif", fontWeight: m.isCurrent ? 600 : 400 }}>{m.sub}</div>
                </div>
                {i < milestones.length - 1 && <div style={{ width: 36, height: 2, background: "linear-gradient(90deg, var(--line) 0%, var(--royal-100) 100%)", flexShrink: 0, marginBottom: 28 }} />}
              </div>
            ))}
          </div>
        </div>
        {foundedYear && phase && (
          <p style={{ margin: "var(--space-4) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-mute)", lineHeight: 1.7 }}>
            {foundedYear}年の創業から{currentYear - foundedYear}年。現在は<strong style={{ color: "var(--ink-soft)" }}>{phase}</strong>ステージ{company.employee_count ? `、従業員${String(company.employee_count).includes("名") ? String(company.employee_count) : String(company.employee_count) + "名"}規模` : ""}。
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Similar Companies Section ───────────────────────────────────────────────

function SimilarCompaniesSection({ companies, currentIndustry }: { companies: Company[]; currentIndustry: string }) {
  if (companies.length === 0) return null;

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{ padding: "var(--space-6) var(--space-6) var(--space-4)", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <SecTitle
          iconColor="warm"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          }
        >
          {currentIndustry}の他の企業
        </SecTitle>
        <Link href={`/companies?industry=${encodeURIComponent(currentIndustry)}`} style={{ fontSize: "var(--text-sm)", color: "var(--royal)", fontWeight: 500, textDecoration: "none" }}>
          一覧を見る →
        </Link>
      </div>
      <div style={{ padding: "var(--space-5) var(--space-6)" }}>
        <style>{`
          .similar-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: var(--space-3);
          }
          @media (max-width: 1023px) {
            .similar-grid { grid-template-columns: repeat(2, 1fr); }
          }
          @media (max-width: 639px) {
            .similar-grid { grid-template-columns: repeat(2, 1fr); }
          }
          .similar-card:hover {
            border-color: var(--royal-100) !important;
            box-shadow: 0 4px 16px rgba(0,35,102,0.08) !important;
            transform: translateY(-2px);
          }
        `}</style>
        <div className="similar-grid">
          {companies.map((co) => {
            const initial = co.name.charAt(0).toUpperCase();
            return (
              <Link key={co.id} href={`/companies/${co.id}`} style={{ textDecoration: "none" }}>
                <div
                  className="similar-card"
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#fff",
                    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
                  }}
                >
                  {/* Mini cover */}
                  <div style={{ height: 56, background: co.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {co.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={co.logo_url} alt={co.name} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, background: "#fff" }} />
                    ) : (
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif", opacity: 0.9 }}>
                        {co.logo_letter ?? initial}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "var(--space-2) 10px var(--space-3)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                      {co.name}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                      {co.phase && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)", fontWeight: 500 }}>
                          {co.phase}
                        </span>
                      )}
                      {co.accepting_casual_meetings && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--success-soft,#ECFDF5)", color: "var(--success)", border: "1px solid #A7F3D0", fontWeight: 600 }}>
                          面談可
                        </span>
                      )}
                    </div>
                    {Array.isArray((co as { company_features?: string[] | null }).company_features) && ((co as { company_features?: string[] | null }).company_features as string[]).length > 0 && (
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {((co as { company_features?: string[] | null }).company_features as string[]).slice(0, 2).map((f: string, fi: number) => (
                          <span key={fi} style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 3, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontWeight: 500 }}>
                            #{f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Company Articles Section ─────────────────────────────────────────────────

function CompanyArticlesSection({ articles }: { articles: Article[] }) {
  const displayed = articles.slice(0, 3);

  return (
    <section
      id="articles"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) var(--space-6) var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          iconColor="default"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          }
        >
          OPINIO 取材記事
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
        {articles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-mute)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>まだ取材記事がありません</div>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>OPINIO編集部による取材記事が順次公開されます</div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
              {displayed.map((article) => {
                const badge = TYPE_BADGE[article.type];
                const icon  = TYPE_EYECATCH_ICON[article.type];
                return (
                  <Link key={article.slug} href={`/articles/${article.slug}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
                        background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s",
                        height: "100%", display: "flex", flexDirection: "column",
                      }}
                      className="article-card"
                    >
                      <div style={{ height: 100, background: article.eyecatch_gradient, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}>
                        <span style={{ fontSize: 36, opacity: 0.3 }}>{icon}</span>
                        <div style={{ position: "absolute", top: 8, left: 10, display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 100, background: badge.bg, color: badge.color, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em" }}>
                          {badge.label}
                        </div>
                        <div style={{ position: "absolute", bottom: 7, right: 10, fontSize: 9, color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                          {article.read_min} min read
                        </div>
                      </div>
                      <div style={{ padding: "var(--space-3) 14px", flex: 1 }}>
                        <p style={{ margin: 0, fontFamily: "var(--font-noto-serif)", fontSize: 12, fontWeight: 700, lineHeight: 1.6, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                          {article.title}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div style={{ marginTop: "var(--space-4)", textAlign: "right" }}>
              <Link href="/articles" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textDecoration: "none", fontFamily: "Inter, sans-serif", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                記事一覧を見る
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── MobileBottomCTA ── γ-7: モバイル固定底部バー (< 768px) ──────────────────
function MobileBottomCTA({ company }: { company: Company }) {
  const hasMeeting = company.jobs_public === true;
  const hasJobs = company.job_count > 0;
  if (!hasMeeting && !hasJobs) return null;

  return (
    <div
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 64, // モバイルボトムナビ（64px）の上に配置
        left: 0,
        right: 0,
        zIndex: 40,
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid var(--line)",
        padding: "10px 16px",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.06)",
      }}
    >
      {hasMeeting && (
        <Link
          href={`/companies/${company.id}/casual-meeting`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            padding: "var(--space-3) 0",
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            color: "#fff",
            borderRadius: 8,
            fontSize: "var(--text-base)",
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
            marginBottom: hasJobs ? "var(--space-2)" : 0,
            boxShadow: "0 3px 12px rgba(245,158,11,0.35)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#fff",
              flexShrink: 0,
              animation: "cta-pulse 1.8s ease-in-out infinite",
            }}
          />
          話を聞く（カジュアル面談）
        </Link>
      )}
      {hasJobs && (
        <a
          href="#jobs"
          style={{
            display: "block",
            padding: "10px 0",
            background: hasMeeting ? "var(--royal-50)" : "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
            color: hasMeeting ? "var(--royal)" : "#fff",
            border: hasMeeting ? "1px solid var(--royal-100)" : "none",
            borderRadius: 8,
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
            boxShadow: hasMeeting ? "none" : "0 3px 12px rgba(0,35,102,0.25)",
          }}
        >
          求人を見て応募する
        </a>
      )}
    </div>
  );
}

function Sidebar({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  return (
    <aside
      style={{
        position: "sticky",
        top: 132,
        alignSelf: "start",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
      className="hidden lg:flex"
    >
      {/* CTA card ── γ-2: 修正① CTA 優先順位逆転 */}
      {(() => {
        const hasMeeting = company.jobs_public === true;
        const hasJobs = company.job_count > 0;
        return (
          <div
            style={{
              background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
              color: "#fff",
              padding: "var(--space-6)",
              borderRadius: 16,
              boxShadow: "0 12px 32px rgba(0,35,102,0.2)",
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                opacity: 0.72,
                marginBottom: 6,
                letterSpacing: "0.06em",
              }}
            >
              {company.name}
            </div>

            {/* Heading */}
            <div
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "var(--text-md)",
                fontWeight: 500,
                marginBottom: "var(--space-4)",
                lineHeight: 1.55,
              }}
            >
              {hasMeeting
                ? "対話から、はじめよう。"
                : hasJobs
                  ? `${company.job_count}件の求人を、見てみませんか？`
                  : "現在、受付中の求人・面談はありません"}
            </div>

            {/* ── case 1 & 2: accepting_casual_meetings = true ── */}
            {hasMeeting && (
              <>
                {/* 1st (Primary): 話を聞く（カジュアル面談） */}
                <Link
                  href={`/companies/${company.id}/casual-meeting`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-2)",
                    width: "100%",
                    padding: "14px 0",
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    color: "#fff",
                    borderRadius: 8,
                    fontSize: "var(--text-base)",
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "none",
                    boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
                    boxSizing: "border-box",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#fff",
                      flexShrink: 0,
                      animation: "cta-pulse 1.8s ease-in-out infinite",
                    }}
                  />
                  話を聞く（カジュアル面談）
                </Link>
                {/* 補足テキスト: Primary ボタン直下、Primary 表示時のみ */}
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    textAlign: "center",
                    margin: "8px 0",
                    opacity: 0.68,
                    lineHeight: 1.4,
                  }}
                >
                  人事担当者が直接対応します
                </p>
                {/* 2nd (Secondary): 求人を見て応募する — job_count > 0 の時のみ */}
                {hasJobs && (
                  <a
                    href="#jobs"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 4,
                      padding: "9px 0",
                      background: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.28)",
                      borderRadius: 8,
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    求人を見て応募する
                  </a>
                )}
              </>
            )}

            {/* ── case 3: accepting_casual_meetings = false, job_count > 0 ── */}
            {!hasMeeting && hasJobs && (
              <a
                href="#jobs"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "11px 0",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.28)",
                  borderRadius: 8,
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                求人を見て応募する
              </a>
            )}

            {/* ── case 4: accepting_casual_meetings = false, job_count = 0 ── */}
            {!hasMeeting && !hasJobs && (
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  textAlign: "center",
                  opacity: 0.68,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                現在募集中の情報がありません
              </p>
            )}
          </div>
        );
      })()}

      {/* 申し込みの流れ — casual meeting flow steps */}
      {company.jobs_public === true && (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: "var(--space-4)",
            boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
          }}
        >
          <div
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "#334155",
              letterSpacing: "0.02em",
              marginBottom: "var(--space-4)",
              fontFamily: "var(--font-noto-sans)",
            }}
          >
            申し込みの流れ
          </div>
          {[
            { n: "1", label: "フォームで申し込む", sub: "1分で完了" },
            { n: "2", label: "採用担当者から連絡" },
            { n: "3", label: "日程を調整" },
            { n: "4", label: "カジュアル面談（約30分）", sub: "無料・秘密厳守" },
          ].map(({ n, label, sub }, i, arr) => (
            <div key={n} style={{ display: "flex", gap: "var(--space-3)", position: "relative" }}>
              {/* Connector line */}
              {i < arr.length - 1 && (
                <div style={{
                  position: "absolute", left: 10, top: 22, bottom: -8, width: 1,
                  background: "var(--line-soft)",
                }} />
              )}
              {/* Step number circle */}
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: i === 0 ? "var(--warm)" : "var(--bg-tint)",
                border: i === 0 ? "none" : "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                color: i === 0 ? "#fff" : "var(--ink-mute)",
                fontFamily: "Inter, sans-serif",
                boxShadow: i === 0 ? "0 2px 8px rgba(245,158,11,0.3)" : "none",
              }}>
                {n}
              </div>
              {/* Label */}
              <div style={{ paddingBottom: i < arr.length - 1 ? 18 : 0 }}>
                <div style={{
                  fontSize: "var(--text-sm)", fontWeight: i === 0 ? 600 : 500,
                  color: i === 0 ? "var(--ink)" : "var(--ink-soft)",
                  lineHeight: 1.35,
                }}>
                  {label}
                </div>
                {sub && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", marginTop: 2 }}>
                    {sub}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Company Info */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "var(--space-6)",
          boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
        }}
      >
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#334155",
            marginBottom: "var(--space-3)",
            fontFamily: "var(--font-noto-sans)",
          }}
        >
          企業情報
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* ジャンルチップ: 登録済み企業のみ表示、未登録は行ごと非表示 */}
          {company.genres.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "76px 1fr",
                gap: "var(--space-2)",
                fontSize: "var(--text-sm)",
                alignItems: "flex-start",
                padding: "var(--space-2) 0",
                borderBottom: "1px solid var(--line-soft)",
              }}
            >
              <span style={{ color: "var(--ink-soft)", fontSize: "var(--text-xs)", fontWeight: 600, paddingTop: 3 }}>ジャンル</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {company.genres.map((g) => (
                  <span
                    key={g.id}
                    style={{
                      padding: "var(--space-1) var(--space-3)",
                      borderRadius: 14,
                      fontSize: "var(--text-xs)",
                      background: "var(--bg-tint)",
                      color: "var(--ink-soft)",
                      border: "1px solid var(--line)",
                      fontWeight: 500,
                    }}
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(
            [
              { key: "業界", value: company.industry, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
              { key: "事業ステージ", value: company.phase, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
              { key: "従業員数", value: company.employee_count ? (() => { const s = String(company.employee_count); return s.includes("名") ? s : s + "名"; })() : "", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              { key: "所在地", value: detail.hq, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
              { key: "最寄り駅", value: detail.nearestStation ?? "—", isUnset: !detail.nearestStation, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M4 14h16"/><path d="M9 4v16"/><path d="M15 4v16"/></svg> },
              { key: "設立", value: detail.established, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { key: "代表者", value: detail.ceo, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              ...(detail.url ? [{ key: "公式サイト", value: detail.url, isLink: true, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }] : []),
            ] as { key: string; value: string; icon: React.ReactNode; isLink?: boolean; isUnset?: boolean }[]
          )
            .filter((item) => item.isUnset || (item.value && item.value !== "—"))
            .map(({ key, value, icon, isLink, isUnset }) => (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr",
                  gap: "var(--space-2)",
                  fontSize: "var(--text-sm)",
                  alignItems: "flex-start",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                <span style={{ color: "var(--ink-soft)", fontSize: "var(--text-xs)", fontWeight: 600, paddingTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                  {icon}{key}
                </span>
                {isLink ? (
                  <a
                    href={value.startsWith("http") ? value : `https://${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--royal)",
                      textDecoration: "underline",
                      fontWeight: 500,
                      wordBreak: "break-all",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {value} →
                  </a>
                ) : isUnset ? (
                  <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{value}</span>
                ) : (
                  <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: "var(--text-sm)" }}>{value}</span>
                )}
              </div>
            ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  // Pull auth out first so we can run ow_users lookup in parallel
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const isAuthenticated = !!authUser;

  const [companyResult, photos, recruiters, companyArticles, employees, owUserResult] = await Promise.all([
    getCompanyByIdCached(params.id),
    getCompanyPhotos(params.id),
    getCompanyRecruiters(params.id),
    getArticlesByCompany(params.id),
    getCompanyEmployees(params.id),
    // ow_users lookup runs in parallel now (was sequential before)
    isAuthenticated
      ? supabase.from("ow_users").select("id").eq("auth_id", authUser!.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!companyResult) return notFound();

  const { company, detail, employeeCategories } = companyResult;

  // Only 1 sequential query remains (bookmark lookup needs owUser.id)
  let initialBookmarked = false;
  const owUserId = owUserResult?.data?.id ?? null;
  if (owUserId) {
    const { data: bmark } = await supabase
      .from("ow_bookmarks")
      .select("id")
      .eq("user_id", owUserId)
      .eq("target_type", "company")
      .eq("target_id", params.id)
      .maybeSingle();
    initialBookmarked = !!bmark;
  }

  // 類似企業（同業界・異フェーズ）
  const similarCompanies = await getSimilarCompanies(params.id, company.industry, company.phase);

  return (
    <>
      <ReadingProgress />
      <BackToTop />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: company.name,
            description: company.tagline ?? undefined,
            url: `https://opinio.jp/companies/${params.id}`,
            numberOfEmployees: company.employee_count > 0 ? {
              "@type": "QuantitativeValue",
              value: company.employee_count,
            } : undefined,
          }),
        }}
      />
      <RecentlyViewedTracker id={params.id} name={company.name} logoUrl={company.logo_url ?? null} logoLetter={company.logo_letter ?? undefined} />
      <Breadcrumb company={company} />
      <Hero company={company} detail={detail} initialBookmarked={initialBookmarked} isAuthenticated={isAuthenticated} recruiters={recruiters} />

      <div style={{ background: "var(--bg-tint)", minHeight: "60vh" }}>
        <CompanyStickyNav items={[
          { id: "about",            label: "企業概要" },
          ...((detail.main_products?.length || detail.main_customers?.length || detail.customer_cases?.length) ? [{ id: "products-clients", label: "製品・顧客" }] : []),
          ...(detail.orgTeams && detail.orgTeams.length > 0 ? [{ id: "org-teams", label: `組織 ${detail.orgTeams.length}チーム` }] : []),
          ...((detail.benefits?.length || detail.evaluationSystem) ? [{ id: "benefits", label: "福利厚生" }] : []),
          ...(company.job_count > 0 ? [{ id: "jobs", label: `求人 ${company.job_count}件` }] : []),
          ...(employees.current.some(e => e.catchphrase) ? [{ id: "voices", label: "社員の声" }] : []),
          ...(employees.current.length > 0 ? [{ id: "current-employees", label: `社員 ${employees.current.length}名` }] : employees.alumni.length > 0 ? [{ id: "current-employees", label: `OB/OG ${employees.alumni.length}名` }] : []),
          ...(companyArticles.length > 0 ? [{ id: "articles", label: `記事 ${companyArticles.length}件` }] : []),
        ]} />
        <div
          style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
          className="px-5 md:px-12 py-7 grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]"
        >
          {/* γ-7: モバイルで fixed bottom bar 分の余白を確保 */}
          <main className="pb-36 md:pb-0">
            {/* 1. 企業概要 */}
            <AboutSection
              detail={detail}
              photos={photos}
            />

            {/* 2. 製品・顧客 */}
            <ProductsClientsSection detail={detail} />

            {/* 5. 組織体制 */}
            <OrgTeamsSectionClient detail={detail} />

            {/* 6. 福利厚生・評価制度 */}
            <BenefitsSection detail={detail} />

            {/* 6. 募集中の求人 */}
            <JobsSection company={company} detail={detail} />

            {/* 6.5 社員の声 */}
            <EmployeeVoicesSection employees={employees.current} />

            {/* 7. 現役社員・OBOGプロフィール */}
            <CurrentEmployeesSection employees={employees.current} categories={employeeCategories} alumniCount={employees.alumni.length} />
            <AlumniSection alumni={employees.alumni} />

            {/* 7. 記事（OPINIO取材記事） */}
            <CompanyArticlesSection articles={companyArticles} />

            {recruiters.length > 0 && (
              <RecruitersSection recruiters={recruiters} />
            )}

            {/* フェーズタイムライン */}
            <CompanyPhaseTimeline company={company} detail={detail} />

            {/* 8. 類似企業 */}
            <SimilarCompaniesSection companies={similarCompanies} currentIndustry={company.industry} />

          </main>

          <Sidebar company={company} detail={detail} />
        </div>
      </div>

      {/* γ-7: モバイル固定底部バー (< 768px) */}
      <MobileBottomCTA company={company} />

      <style>{`
        /* ── Section entrance animation ── */
        @keyframes section-enter {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        main > section, main > div[id], main > div:not([class]) {
          animation: section-enter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        main > *:nth-child(1)  { animation-delay: 0.05s; }
        main > *:nth-child(2)  { animation-delay: 0.1s;  }
        main > *:nth-child(3)  { animation-delay: 0.15s; }
        main > *:nth-child(4)  { animation-delay: 0.2s;  }
        main > *:nth-child(5)  { animation-delay: 0.22s; }
        main > *:nth-child(n+6){ animation-delay: 0.25s; }

        /* ── Job cards ── */
        .job-item-link {
          transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
        }
        .job-item-link:hover {
          border-color: var(--royal) !important;
          box-shadow: 0 6px 20px rgba(0,35,102,0.1) !important;
          transform: translateY(-2px);
        }

        /* ── Employee cards ── */
        .employee-card-link {
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .employee-card-link:hover {
          border-color: var(--royal-100) !important;
          background: #fff !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,35,102,0.08) !important;
        }

        /* ── Voice cards ── */
        .voice-card:hover {
          border-color: var(--purple,#7C3AED) !important;
          box-shadow: 0 4px 16px rgba(124,58,237,0.08) !important;
        }

        /* ── Post / article cards ── */
        .post-card-link:hover { border-color: var(--royal) !important; }
        .company-posts-more-link:hover { background: var(--royal-50) !important; }
        .article-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 4px 16px rgba(0,35,102,0.08) !important;
        }

        /* ── Pulse for CTA dot ── */
        @keyframes cta-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        /* ── Nav no-scrollbar ── */
        nav::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
