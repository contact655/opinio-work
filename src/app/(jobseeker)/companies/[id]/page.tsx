import type { Metadata } from "next";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  getCompanyById,
  getCompanyPhotosCached,
  getCompanyRecruitersCached,
  getArticlesByCompany,
  getCompanyEmployeesCached,
} from "@/lib/supabase/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyPhoto, CompanyRecruiter, CompanyEmployee, CompanyEmployeeCategoryItem } from "@/lib/supabase/queries";
import type { Article } from "@/app/articles/mockArticleData";
import { TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";
import type { Company } from "@/app/companies/mockCompanies";
import { formatUpdated } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { PhotoCarousel } from "./PhotoCarousel";
import BookmarkButton, { CompanyStickyNav, RecentlyViewedTracker, ShareButton, EmployeeAvatarImg } from "./CompanyDetailClient";
import OrgTeamsSectionClient from "./OrgTeamsSectionClient";
import CustomerCasesClient from "./CustomerCasesClient";
// import { GenreCarousel } from "@/components/companies/GenreCarousel";
import EvaluationText from "./EvaluationText";
import SalaryDataSection from "./SalaryData";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { BackToTop } from "@/components/jobseeker/BackToTop";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarColor } from "@/lib/jobCategoryColors";

// Deduplicate getCompanyById calls within a single request
// (generateMetadata and CompanyDetailPage both call it)
const getCompanyByIdCached = cache(getCompanyById);



// 5分間 ISR キャッシュ
export const revalidate = 60;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getCompanyByIdCached(params.id);
  if (!result) return { title: { absolute: "企業が見つかりません | OPINIO" } };
  const { company } = result;

  const description = company.tagline
    ? `${company.tagline}｜${company.industry ?? "IT/SaaS"}業界・${company.employee_count ? company.employee_count.toString() + "名規模" : "詳細はページへ"}。カジュアル面談受付中。`
    : `${company.name}の企業情報・求人・組織文化をOPINIOで確認。カジュアル面談で現場の声を聞けます。`;

  const ogImageUrl = `/api/og?type=company&name=${encodeURIComponent(company.name)}&sub=${encodeURIComponent(company.tagline ?? "")}&badge=${encodeURIComponent(company.industry ?? "IT/SaaS")}`;

  return {
    title: { absolute: `${company.name} — 企業情報・求人 | OPINIO` },
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
  coverPhotoUrl,
}: {
  company: Company;
  detail: CompanyDetail;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
  recruiters: CompanyRecruiter[];
  coverPhotoUrl?: string | null;
}) {
  const displayBrand = (company.brand_name ?? company.name_en ?? company.name)
    .replace(/^(株式会社|有限会社|合同会社|一般社団法人|一般財団法人)\s*/, "").trim();
  const initial = displayBrand.charAt(0).toUpperCase() || company.name.charAt(0).toUpperCase();
  const freshLabel = formatUpdated(company.updated_days_ago);
  const isFresh = company.updated_days_ago <= 30;

  return (
    <section style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      {/* Gradient cover band */}
      <div style={{
        height: 200,
        background: (coverPhotoUrl && /^https:\/\/[a-z]+\.supabase\.co\//.test(coverPhotoUrl)) ? `url(${coverPhotoUrl}) center/cover no-repeat` : company.gradient,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: (coverPhotoUrl && /^https:\/\/[a-z]+\.supabase\.co\//.test(coverPhotoUrl)) ? "linear-gradient(160deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.5) 100%)" : "linear-gradient(160deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.32) 100%)" }} />
        {/* Decorative circles + large initial watermark (gradient only) */}
        {!(coverPhotoUrl && /^https:\/\/[a-z]+\.supabase\.co\//.test(coverPhotoUrl)) && <>
          <div style={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -30, bottom: -80, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          {/* ⑩ Large initial watermark */}
          <div style={{
            position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)",
            fontSize: 120, fontWeight: 900, color: "rgba(255,255,255,0.10)",
            fontFamily: "Inter, sans-serif", lineHeight: 1, userSelect: "none", pointerEvents: "none",
            letterSpacing: "-0.05em",
          }}>
            {initial}
          </div>
        </>}
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
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.gradient}
              companyUrl={company.url}
              size={96}
              borderRadius={18}
              style={{
                marginTop: -56,
                position: "relative",
                zIndex: 1,
                border: "4px solid #fff",
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
              }}
            />
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

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
                {/* CTA: 話を聞く（accepting_casual_meetings が true のとき） */}
                {company.accepting_casual_meetings && (
                  <Link href={`/companies/${company.id}/casual-meeting`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700,
                      background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff",
                      textDecoration: "none",
                      boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
                    }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "cta-pulse 1.8s ease-in-out infinite", display: "inline-block", flexShrink: 0 }} />
                    話を聞く（無料）
                  </Link>
                )}
                {/* ⑨ 気になる bookmark ghost button */}
                <BookmarkButton
                  companyName={company.name}
                  companyId={company.id}
                  initialBookmarked={initialBookmarked}
                  isAuthenticated={isAuthenticated}
                  variant="pill"
                />
              </div>

              {/* ⑨ Perk chips removed — work style info is shown in stats strip below */}

              {/* ③ SNS リンク + 共有ボタン（1行に統合） */}
              {(company.x_url || company.linkedin_url || detail.url || company.careers_url) && (
                <div style={{ display: "flex", gap: 6, marginTop: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
                  {/* X: icon-only circle */}
                  {company.x_url && (
                    <a href={company.x_url} target="_blank" rel="noopener noreferrer" title="X (Twitter)"
                      style={{ width: 30, height: 30, borderRadius: "50%", background: "#000", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                  )}
                  {/* LinkedIn: icon-only circle */}
                  {company.linkedin_url && (
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" title="LinkedIn"
                      style={{ width: 30, height: 30, borderRadius: "50%", background: "#0A66C2", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                    </a>
                  )}
                  {detail.url && (
                    <a href={detail.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 8, background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)", textDecoration: "none", fontSize: 11, fontWeight: 600 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      公式サイト
                    </a>
                  )}
                  {company.careers_url && (
                    <a href={company.careers_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 8, background: "var(--warm-soft)", color: "#92400E", border: "1px solid #FDE68A", textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                      採用情報
                    </a>
                  )}
                  {/* 共有: ShareButtonをここに統合 */}
                  <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0, marginLeft: 4 }} />
                  <ShareButton companyName={company.name} companyId={company.id} />
                </div>
              )}
            </div>
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
                href: undefined as string | undefined,
              },
              ...(salaryRangeValue ? [{
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                label: "想定年収",
                value: salaryRangeValue,
                color: "var(--success)",
                href: undefined as string | undefined,
              }] : []),
              ...(company.job_count > 0 ? [{
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>,
                label: "募集中の求人",
                value: `${company.job_count}件`,
                color: "#D97706",
                href: "#jobs" as string | undefined,
              }] : []),
              ...(detail.numbers.fundingTotal ? [{
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                label: "累計調達",
                value: detail.numbers.fundingTotal,
                color: "#7C3AED",
                href: undefined as string | undefined,
              }] : []),
            ] as { icon: React.ReactNode; label: string; value: string | null; color: string; href?: string }[]
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
              {stats.map(({ icon, label, value, color, href }, i) => {
                const inner = (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color, flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, letterSpacing: "0.02em" }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 20, color: href ? color : "var(--ink)", fontWeight: 800, fontFamily: "var(--font-noto-sans)", letterSpacing: "-0.02em" }}>
                      {value}{href && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ marginLeft: 2, verticalAlign: "middle" }}><polyline points="9 18 15 12 9 6"/></svg>}
                    </span>
                  </>
                );
                const cellStyle: React.CSSProperties = {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "10px 0",
                  borderRight: i < stats.length - 1 ? "1px solid var(--line-soft)" : "none",
                  ...(href ? { cursor: "pointer", textDecoration: "none" } : {}),
                };
                return href ? (
                  <a key={label} href={href} style={cellStyle}>{inner}</a>
                ) : (
                  <div key={label} style={cellStyle}>{inner}</div>
                );
              }
              )}
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
        fontFamily: 'var(--font-noto-sans)',
        fontWeight: 800,
        fontSize: 20,
        color: "var(--ink)",
        letterSpacing: "-0.01em",
        lineHeight: 1.25,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: iconBg[iconColor],
          color: iconFg[iconColor],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 15,
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
        padding: "var(--space-6) 32px var(--space-4)",
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
      <div style={{ padding: "var(--space-6) 32px var(--space-6)" }}>

        {/* オフィス写真グリッド */}
        <PhotoCarousel photos={photos} />

        {/* ① 会社概要 — 全幅 */}
        {detail.about && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            {detail.about.split("\n").filter(line => line.trim()).map((line, i) => (
              <p key={i} style={{ margin: i > 0 ? "14px 0 0" : 0, fontSize: 15, color: "var(--ink)", lineHeight: 1.85, fontFamily: "var(--font-noto-sans)" }}>
                {line.trim()}
              </p>
            ))}
          </div>
        )}

        {/* ② WHY JOIN */}
        {detail.why_join && (
          <div style={{ paddingTop: 4 }}>
            {/* サブセクション見出し */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>
                この会社の魅力
              </h3>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            {/* 本文: 「。」区切りでポイント表示 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {detail.why_join.split(/。(?!\s*$)/).filter(s => s.trim()).map((sentence, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                    background: "var(--royal-50)", color: "var(--royal)",
                    border: "1.5px solid var(--royal-100)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, fontFamily: "Inter",
                    marginTop: 2,
                  }}>{i + 1}</span>
                  <p style={{ margin: 0, fontSize: 15, color: "var(--ink)", lineHeight: 1.9, fontFamily: "var(--font-noto-sans)" }}>
                    {sentence.trim().replace(/。$/, "")}。
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ③ CULTURE */}
        {detail.culture_description && (
          <div style={{ marginTop: 28 }}>
            {/* サブセクション見出し */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>
                組織文化・働く環境
              </h3>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", textTransform: "uppercase" as const, flexShrink: 0 }}>
                CULTURE
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            {/* キーワードを先に */}
            {detail.culture_keywords && detail.culture_keywords.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {detail.culture_keywords.map((kw, i) => (
                  <span key={i} style={{
                    fontSize: 13, padding: "6px 14px", borderRadius: 100,
                    background: "var(--royal-50)", color: "var(--royal)",
                    border: "1px solid var(--royal-100)", fontWeight: 700,
                    fontFamily: "var(--font-noto-sans)",
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
            {/* 説明テキスト */}
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, fontFamily: "var(--font-noto-sans)" }}>
              {detail.culture_description}
            </p>
          </div>
        )}

        {/* ④ 会社の特徴・強み */}
        {detail.company_features && detail.company_features.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>
                会社の特徴・強み
              </h3>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {detail.company_features.map((f, i) => (
                <span key={i} style={{
                  padding: "6px 14px", borderRadius: 8,
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

/** キーワードベースで製品カードのスタイルを決める（カテゴリ別カラー） */
function productStyle(name: string): { bg: string; border: string; color: string; icon: React.ReactNode } {
  const n = name.toLowerCase();
  // Sales/CRM → royal blue
  const ROYAL = { bg: "var(--royal-50)", border: "var(--royal-100)", color: "var(--royal)" };
  // Marketing → warm amber
  const WARM = { bg: "#FEF3C7", border: "#FDE68A", color: "#92400E" };
  // Analytics/Data → purple
  const PURPLE = { bg: "#F3E8FF", border: "#DDD6FE", color: "#7C3AED" };
  // Service/Support/CS → green
  const GREEN = { bg: "#D1FAE5", border: "#A7F3D0", color: "#065F46" };
  // AI/ML → indigo
  const INDIGO = { bg: "#EEF2FF", border: "#C7D2FE", color: "#4338CA" };
  // Integration/API/Platform → slate
  const SLATE = { bg: "#F1F5F9", border: "#CBD5E1", color: "#475569" };
  // Cloud/Platform → sky
  const SKY = { bg: "#E0F2FE", border: "#BAE6FD", color: "#0369A1" };

  if (/(crm|sales|営業|セールス)/.test(n))
    return { ...ROYAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> };
  if (/(market|マーケ|メール|email)/.test(n))
    return { ...WARM, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> };
  if (/(analytic|data|分析|レポ|insight|tableau|bi)/.test(n))
    return { ...PURPLE, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> };
  if (/(service|support|サービス|サポート|cs|カスタマ|success)/.test(n))
    return { ...GREEN, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> };
  if (/(platform|cloud|クラウド|プラットフォーム)/.test(n))
    return { ...SKY, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg> };
  if (/(ai|ml|機械学習|人工知能|llm|gpt|agentforce|einstein)/.test(n))
    return { ...INDIGO, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> };
  if (/(integrat|api|連携|インテグレ|mule|slack|コラボ)/.test(n))
    return { ...SLATE, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> };
  if (/(hr|human|採用|人事|タレント|talent|commerce|ec|financial)/.test(n))
    return { ...GREEN, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg> };
  return { ...ROYAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> };
}

function ProductsClientsSection({ detail, company }: { detail: CompanyDetail; company: Company }) {
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
      <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>主な製品・サービス</h3>
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>{detail.main_products!.length}製品</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <style>{`
              .products-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--space-2);
              }
              @media (min-width: 640px) {
                .products-grid { grid-template-columns: repeat(3, 1fr); }
              }
              @media (min-width: 900px) {
                .products-grid { grid-template-columns: repeat(5, 1fr); }
              }
            `}</style>
            <div className="products-grid">
              {detail.main_products!.map((raw, i) => {
                const { name } = parseProductName(raw);
                const s = productStyle(name);
                return (
                  <div
                    key={i}
                    style={{
                      background: "#fff",
                      border: `1px solid var(--line)`,
                      borderRadius: 10,
                      padding: "10px var(--space-3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 56,
                    }}
                  >
                    {/* アイコン */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {s.icon}
                    </div>
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.35, fontFamily: "var(--font-noto-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </p>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>主な導入事例</h3>
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>{detail.customer_cases!.length}社</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <CustomerCasesClient cases={detail.customer_cases!} defaultCollapsed={detail.customer_cases!.length > 3} />
          </div>
        )}

        {/* ── 顧客タグ（customer_cases がない場合のフォールバック） ── */}
        {!hasCases && hasCustomers && (
          <div>
            {hasProducts && <div style={{ height: 1, background: "var(--line)", marginBottom: "var(--space-6)", marginTop: -8 }} />}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--royal)", fontFamily: "var(--font-noto-sans)", letterSpacing: "0.02em" }}>
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
                    background: "var(--royal-50)",
                    border: "1px solid var(--royal-100)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--royal)",
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

        {/* ⑥ 求人 CTA */}
        {company.job_count > 0 && (
          <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: "var(--space-4)", marginTop: "var(--space-2)" }}>
            <Link href={`/companies/${company.id}/jobs`} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: "#FEF3C7", color: "#92400E",
              border: "1px solid #FDE68A",
              textDecoration: "none",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
              この企業の求人を見る（{company.job_count}件）→
            </Link>
          </div>
        )}

      </div>
    </section>
  );
}


// ─── Benefits Section ─────────────────────────────────────────────────────────

function SubSectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>{children}</h3>
      {note && <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>{note}</span>}
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

function BenefitsSection({ detail }: { detail: CompanyDetail }) {
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
        padding: "var(--space-6) 32px var(--space-4)",
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
        // SVGベースの福利厚生アイコン（キーワード → SVG）
        type BenefitIconDef = { svg: React.ReactNode; color: string; bg: string; border: string };
        function getBenefitIconDef(benefit: string): BenefitIconDef {
          const b = benefit;
          const royal: BenefitIconDef = {
            color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)",
            svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
          };
          if (b.includes("リモート") || b.includes("在宅") || b.includes("テレワーク") || b.includes("フルリモート"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> };
          if (b.includes("フレックス") || b.includes("時差出勤"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> };
          if (b.includes("副業") || b.includes("兼業"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> };
          if (b.includes("ストックオプション") || b.includes("SO") || b.includes("持株"))
            return { color: "#065f46", bg: "#d1fae5", border: "#a7f3d0", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> };
          if (b.includes("書籍") || b.includes("学習") || b.includes("研修") || b.includes("勉強会") || b.includes("資格"))
            return { color: "#5b21b6", bg: "#ede9fe", border: "#ddd6fe", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> };
          if (b.includes("育休") || b.includes("産休") || b.includes("子育て") || b.includes("保育"))
            return { color: "#9a3412", bg: "#ffedd5", border: "#fed7aa", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> };
          if (b.includes("食事") || b.includes("ランチ") || b.includes("社食"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> };
          if (b.includes("健康") || b.includes("医療") || b.includes("保険"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> };
          if (b.includes("確定拠出") || b.includes("退職金"))
            return { color: "#065f46", bg: "#d1fae5", border: "#a7f3d0", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> };
          // default: checkmark
          return royal;
        }
        const BENEFIT_CATEGORIES = [
          { key: "work_style", label: "働き方", keywords: ["リモート", "在宅", "テレワーク", "フルリモート", "フレックス", "時差", "副業", "兼業"] },
          { key: "rewards",    label: "報酬・株式", keywords: ["ストックオプション", "SO", "持株", "確定拠出", "退職金", "給与", "賞与", "インセンティブ"] },
          { key: "growth",     label: "学習・成長", keywords: ["書籍", "学習", "研修", "勉強会", "資格", "セミナー"] },
          { key: "family",     label: "育児・家族", keywords: ["育休", "産休", "子育て", "保育"] },
          { key: "health",     label: "食事・健康", keywords: ["食事", "ランチ", "社食", "健康", "医療", "保険"] },
        ];
        function categorize(b: string) {
          for (const cat of BENEFIT_CATEGORIES) {
            if (cat.keywords.some(kw => b.includes(kw))) return cat.key;
          }
          return "other";
        }
        const grouped = new Map<string, string[]>();
        if (detail.benefits) {
          for (const b of detail.benefits) {
            const key = categorize(b);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(b);
          }
        }
        const _orderedKeys = [...BENEFIT_CATEGORIES.map(c => c.key), "other"].filter(k => grouped.has(k));
        const _categoryLabel = (k: string) => BENEFIT_CATEGORIES.find(c => c.key === k)?.label ?? "その他";

        return (
      <div style={{ marginBottom: "var(--space-6)" }}>
        <SubSectionHeading>福利厚生</SubSectionHeading>
        {detail.benefits && detail.benefits.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {detail.benefits.map((b) => {
              const def = getBenefitIconDef(b);
              return (
                <div
                  key={b}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
                    padding: "14px 14px",
                    background: def.bg, border: `1px solid ${def.border}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: "#fff", border: `1px solid ${def.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: def.color, flexShrink: 0,
                  }}>
                    <span style={{ display: "flex", alignItems: "center", transform: "scale(1.5)" }}>{def.svg}</span>
                  </div>
                  <span style={{ fontSize: 12, color: def.color, fontWeight: 700, lineHeight: 1.4 }}>
                    {b}
                  </span>
                </div>
              );
            })}
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
        <SubSectionHeading>評価制度</SubSectionHeading>
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

// ─── Fit Section（向いている人・向かない人）────────────────────────────────────

function FitSection({ detail }: { detail: CompanyDetail }) {
  const hasPos = detail.fit_positives && detail.fit_positives.length > 0;
  const hasNeg = detail.fit_negatives && detail.fit_negatives.length > 0 && detail.show_fit_negatives;
  if (!hasPos && !hasNeg) return null;

  return (
    <section
      id="fit"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "var(--royal-50)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>こんな人に向いています</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--royal)", fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", border: "1px solid var(--royal-100)" }}>
          OPINIO編集部
        </span>
      </div>
      <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: hasPos && hasNeg ? "1fr 1fr" : "1fr", gap: 16 }}>
        {hasPos && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              こんな人に向いている
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.fit_positives!.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "var(--success-soft)", borderRadius: 10, border: "1px solid #A7F3D0" }}>
                  <span style={{ color: "var(--success)", flexShrink: 0, marginTop: 2, fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasNeg && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--error)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              こんな人には向かない
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.fit_negatives!.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "var(--error-soft)", borderRadius: 10, border: "1px solid #FECACA" }}>
                  <span style={{ color: "var(--error)", flexShrink: 0, marginTop: 2, fontSize: 14 }}>✗</span>
                  <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Reality Disclosure Section ──────────────────────────────────────────────

function RealityDisclosureSection({ detail }: { detail: CompanyDetail }) {
  const rd = detail.reality_disclosure;
  if (!rd) return null;

  const hasNotFor = !!(rd.notFor?.trim());
  const hasTurnover = !!(rd.turnoverReasons && rd.turnoverReasons.length > 0);
  const hasGaps = !!(rd.onboardingGaps?.trim());
  if (!hasNotFor && !hasTurnover && !hasGaps) return null;

  return (
    <section
      id="reality"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "var(--error-soft)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>リアル開示</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--error)", fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--error-soft)", border: "1px solid #FECACA" }}>
          企業自己申告
        </span>
      </div>
      <div style={{ padding: "var(--space-6) 32px" }}>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 20 }}>
          GreenやLinkedInには載らない、企業が自ら開示する「本音情報」です。入社後のミスマッチ防止のために公開しています。
        </p>

        {hasNotFor && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>
              こんな方には向かないかもしれません
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, padding: "12px 16px", background: "var(--bg-tint)", borderRadius: 8, borderLeft: "3px solid var(--error)" }}>
              {rd.notFor}
            </div>
          </div>
        )}

        {hasTurnover && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>
              よくある退職理由
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {rd.turnoverReasons!.map((reason) => (
                <span key={reason} style={{
                  fontSize: 12, color: "var(--ink-soft)", padding: "4px 10px",
                  borderRadius: 100, background: "#F8FAFC", border: "1px solid var(--line)",
                }}>
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasGaps && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>
              入社後にギャップを感じやすいこと
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, padding: "12px 16px", background: "var(--bg-tint)", borderRadius: 8, borderLeft: "3px solid var(--warm)" }}>
              {rd.onboardingGaps}
            </div>
          </div>
        )}
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
      <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
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
                      background: avatarColor.bg,
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 13, color: avatarColor.text,
                      overflow: "hidden", border: "1.5px solid var(--line)",
                      position: "relative",
                    }}>
                      {emp.avatarUrl ? (
                        <EmployeeAvatarImg src={emp.avatarUrl} alt={emp.name} fallbackBg={avatarColor.bg} fallbackText={emp.avatarInitial ?? emp.name.charAt(0)} fallbackColor={avatarColor.text} fontSize={13} />
                      ) : emp.avatarInitial}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {emp.name}
                      </div>
                      {emp.roleTitle && (
                        <div style={{ fontSize: 12, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: avatarColor.bg,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-noto-serif)",
        fontWeight: 700,
        fontSize: 22,
        color: avatarColor.text,
        overflow: "hidden",
        border: "2px solid var(--line)",
        position: "relative",
      }}
    >
      {employee.avatarUrl ? (
        <EmployeeAvatarImg src={employee.avatarUrl} alt={employee.name} fallbackBg={avatarColor.bg} fallbackText={employee.avatarInitial ?? employee.name.charAt(0)} fallbackColor={avatarColor.text} fontSize={22} />
      ) : (
        employee.avatarInitial
      )}
    </div>
  );

  const nameAndRole = (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
          {employee.name}
        </span>
      </div>
      {employee.roleTitle && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--ink-soft)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {employee.roleTitle}
        </p>
      )}
      {employee.catchphrase && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.4,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
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
  .alumni-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
`;


function CurrentEmployeesSection({
  employees,
  categories,
}: {
  employees: CompanyEmployee[];
  categories: CompanyEmployeeCategoryItem[];
}) {
  // ⑨ 0名でも empty state を表示するため早期 return を削除

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
    const groupKey = cat.parentId ?? cat.roleId ?? cat.id;
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
        padding: "var(--space-6) 32px var(--space-4)",
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
          textAlign: "center",
          padding: "40px 24px",
          color: "var(--ink-mute)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📸</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>
            社員プロフィールを準備中です
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            現役社員・OB/OGがプロフィールを登録すると<br />ここに表示されます
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
              (sum, cat) => sum + (empsByCategory.get(cat.roleId ?? "")?.length ?? 0),
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
                    {(empsByCategory.get(group.children[0].roleId ?? "") ?? []).map((emp) => (
                      <EmployeeCard key={emp.userId} employee={emp} />
                    ))}
                  </div>
                ) : (
                  // 子カテゴリあり: 子見出し + グリッド
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {group.children.map((cat) => {
                      const empsInCat = empsByCategory.get(cat.roleId ?? "") ?? [];
                      if (empsInCat.length === 0) return null;
                      return (
                        <div key={cat.roleId ?? cat.id}>
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
        gap: 12,
        padding: "16px",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        textDecoration: "none",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
      }}
    >
      {/* 上段: アバター + 名前・役職 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: avatarColor.bg,
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 24,
          color: avatarColor.text, overflow: "hidden",
          border: "3px solid #fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
          position: "relative",
        }}>
          {employee.avatarUrl ? (
            <EmployeeAvatarImg
              src={employee.avatarUrl}
              alt={employee.name}
              fallbackBg={avatarColor.bg}
              fallbackText={employee.avatarInitial ?? employee.name.charAt(0)}
              fallbackColor={avatarColor.text}
              fontSize={22}
            />
          ) : employee.avatarInitial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
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
            <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", marginTop: 3, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
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

      {/* 中段: 現在のキャリア */}
      {employee.currentCompanyName && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 8,
          background: "var(--bg-tint)", border: "1px solid var(--line-soft)",
          fontSize: 11,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span style={{ color: "var(--ink-mute)", flexShrink: 0 }}>現在:</span>
          <span style={{ color: "var(--ink-soft)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {employee.currentCompanyName}{employee.currentRoleTitle ? ` · ${employee.currentRoleTitle}` : ""}
          </span>
        </div>
      )}

      {/* catchphrase: 相談できること */}
      {employee.catchphrase && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "linear-gradient(135deg, var(--royal-50) 0%, #f0f4ff 100%)",
          border: "1px solid var(--royal-100)",
          position: "relative",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--royal)", opacity: 0.65, letterSpacing: "0.06em", marginBottom: 5, fontFamily: "Inter, sans-serif", textTransform: "uppercase" }}>
            コメント
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--royal)" style={{ flexShrink: 0, marginTop: 1, opacity: 0.35 }}>
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
            </svg>
            <span style={{ fontSize: 13, color: "var(--royal)", lineHeight: 1.6, fontWeight: 600 }}>{employee.catchphrase}</span>
          </div>
        </div>
      )}

      {/* 下段: CTAボタン */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          display: "inline-flex", alignItems: "center",
          padding: "6px 14px", borderRadius: 8,
          background: "var(--royal)", color: "#fff",
          fontSize: 12, fontWeight: 700,
          gap: 5,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          キャリアを見る
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
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
        padding: "var(--space-6) 32px var(--space-4)",
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
          <div style={{ display: "grid", gridTemplateColumns: alumni.length <= 2 ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
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

// ── Embedded job card (clickable link, no accordion) ──────────────────────────
function JobEmbedCard({
  job,
  catName,
  companyHQ,
}: {
  job: import("@/app/companies/[id]/mockDetailData").JobItem;
  catName: string;
  companyHQ: string;
}) {
  const hasSalary = (job.salaryMin && job.salaryMin > 0) || (job.salaryMax && job.salaryMax > 0);
  const salaryDisplay = hasSalary
    ? (job.salaryMin && job.salaryMax
      ? `${job.salaryMin}〜${job.salaryMax}万円`
      : job.salaryMin ? `${job.salaryMin}万円〜` : `〜${job.salaryMax}万円`)
    : "応相談";

  // Location: hide if same city as company HQ
  const jobLoc = job.location?.trim() || "";
  const showLoc = jobLoc && jobLoc !== companyHQ && !companyHQ.includes(jobLoc) && !jobLoc.includes(companyHQ);
  const isRemote = jobLoc.includes("リモート") || jobLoc.includes("在宅") || jobLoc.includes("フルリモート");

  // Days-ago badge
  function daysAgoBadge(): string | null {
    if (job.publishedAt) {
      const d = Math.floor((Date.now() - new Date(job.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (d === 0) return "今日";
      if (d <= 7) return `${d}日前`;
      return null;
    }
    if (job.is_new) return "新着";
    return null;
  }
  const badge = daysAgoBadge();

  const href = job.id ? `/jobs/${job.id}` : "#jobs";

  return (
    <Link
      href={href}
      style={{ textDecoration: "none", display: "block" }}
      className="job-embed-card"
    >
      <div style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "#fff",
        padding: "14px 16px",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        {/* Left accent bar by category */}
        <div style={{ width: 3, borderRadius: 2, background: "var(--royal)", flexShrink: 0, alignSelf: "stretch", opacity: 0.5 }} />
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, flex: 1, minWidth: 0 }}>
              {job.title}
            </div>
            {/* Salary */}
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              {hasSalary ? (
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif" }}>
                  {salaryDisplay}
                </span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>応相談</span>
              )}
            </div>
          </div>
          {/* Catch copy / description fallback */}
          {(job.catchCopy || job.description) && (
            <p style={{
              margin: "0 0 7px", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.55,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
            }}>
              {job.catchCopy || (job.description ? job.description.slice(0, 100) : "")}
            </p>
          )}
          {/* Meta pills */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 4,
              background: "var(--royal-50)", color: "var(--royal)",
              border: "1px solid var(--royal-100)", fontWeight: 600,
            }}>{catName}</span>
            {showLoc && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 10, padding: "2px 7px", borderRadius: 4,
                background: isRemote ? "#f0fdf4" : "var(--bg-tint)",
                color: isRemote ? "var(--success)" : "var(--ink-mute)",
                border: `1px solid ${isRemote ? "#A7F3D0" : "var(--line)"}`,
                fontWeight: 500,
              }}>
                {isRemote ? "🏠" : "📍"} {jobLoc}
              </span>
            )}
            {/* ④ 勤務形態 + 雇用形態 */}
            {job.workStyle && (() => {
              const WS: Record<string, string> = { full_remote: "フルリモート", hybrid: "ハイブリッド", on_site: "出社" };
              const label = WS[job.workStyle] ?? job.workStyle;
              return (
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--success-soft,#ECFDF5)", color: "var(--success)", border: "1px solid #A7F3D0", fontWeight: 600 }}>{label}</span>
              );
            })()}
            {job.employmentType && (
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)", fontWeight: 500 }}>{job.employmentType}</span>
            )}
            {job.urgency === "hot" && (
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 4,
                background: "#FEE2E2", color: "#DC2626",
                border: "1px solid #FECACA", fontWeight: 700,
              }}>🔥 HOT</span>
            )}
            {badge && (
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 4,
                background: "var(--success-soft,#ECFDF5)", color: "var(--success)",
                border: "1px solid #A7F3D0", fontWeight: 700,
              }}>{badge}</span>
            )}
          </div>
        </div>
        {/* Arrow */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 3 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </Link>
  );
}

function JobsSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  const totalJobs = detail.jobs.reduce((sum, cat) => sum + cat.total, 0);
  const companyHQ = detail.hq || "";

  // Sort items: salary-disclosed first
  function sortItems(items: typeof detail.jobs[0]["items"]) {
    return [...items].sort((a, b) => {
      const aHas = (a.salaryMin && a.salaryMin > 0) || (a.salaryMax && a.salaryMax > 0) ? 1 : 0;
      const bHas = (b.salaryMin && b.salaryMin > 0) || (b.salaryMax && b.salaryMax > 0) ? 1 : 0;
      return bHas - aHas;
    });
  }

  // ── 0 件 ────────────────────────────────────────────────────────────────────
  if (totalJobs === 0) {
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
        <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
          <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>}>
            募集中の求人
          </SecTitle>
        </div>
        <div style={{ padding: "var(--space-6)", textAlign: "center" }}>
          <p style={{ fontSize: "var(--text-base)", color: "var(--ink-soft)", padding: "24px 0", margin: 0 }}>
            現在、公開中の求人はありません。
          </p>
          {company.accepting_casual_meetings && (
            <Link href={`/companies/${company.id}/casual-meeting`} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#fff",
              textDecoration: "none", boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
            }}>
              カジュアル面談でまず話してみる
            </Link>
          )}
        </div>
      </section>
    );
  }

  // Limit: top 3 categories × 3 items each
  const displayCats = detail.jobs.slice(0, 3).map(cat => ({
    ...cat,
    displayItems: sortItems(cat.items).slice(0, 3),
  }));

  return (
    <>
    <style suppressHydrationWarning>{`
      .job-embed-card:hover > div {
        border-color: var(--royal) !important;
        box-shadow: 0 4px 14px rgba(0,35,102,0.10) !important;
        transform: translateY(-1px);
      }
    `}</style>
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
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-2)",
      }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>} iconColor="warm">
          募集中の求人
          <span style={{ fontSize: "var(--text-xs)", color: "#D97706", fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
            {company.job_count}件
          </span>
        </SecTitle>
        <Link
          href={`/companies/${company.id}/jobs`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "6px 14px", borderRadius: 8,
            background: "#FEF3C7", color: "#92400E",
            border: "1px solid #FDE68A",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          すべての求人を検索（{company.job_count}件）
        </Link>
      </div>

      <div style={{ padding: "20px 24px 28px", background: "var(--bg-tint)" }}>
        {/* Categories */}
        {displayCats.map((cat, ci) => (
          <div key={cat.cat} style={{ marginBottom: ci < displayCats.length - 1 ? 20 : 0 }}>
            {/* Flat category header */}
            {detail.jobs.length > 1 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
                  {cat.cat}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif",
                  color: "var(--ink-mute)", background: "var(--bg-tint)",
                  border: "1px solid var(--line)", padding: "1px 7px", borderRadius: 100,
                }}>
                  {cat.total}件
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cat.displayItems.map((job, ji) => (
                <JobEmbedCard
                  key={job.id ?? `${ci}-${ji}`}
                  job={job}
                  catName={cat.cat}
                  companyHQ={companyHQ}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Consolidated CTA */}
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <Link
            href={`/companies/${company.id}/jobs`}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "11px 28px", background: "var(--royal)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 2px 8px rgba(0,35,102,0.2)",
            }}
          >
            {company.job_count}件すべての求人を見る →
          </Link>
        </div>
      </div>
    </section>
    </>
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
        padding: "var(--space-6) 32px var(--space-4)",
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

function _CompanyPhaseTimeline({ company, detail }: { company: Company; detail: CompanyDetail }) {
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
      <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}>成長フェーズ</SecTitle>
      </div>
      <div style={{ padding: "var(--space-6) 32px var(--space-6)" }}>
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

function _SimilarCompaniesSection({ companies, currentIndustry }: { companies: Company[]; currentIndustry: string }) {
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
      <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
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
      <div style={{ padding: "var(--space-6) 32px" }}>
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
                    <CompanyLogo
                      name={co.name}
                      logoUrl={co.logo_url}
                      logoLetter={co.logo_letter}
                      logoGradient={co.gradient}
                      size={36}
                      borderRadius={6}
                    />
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

// ─── Company Posts Section ────────────────────────────────────────────────────

type CompanyPost = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  cover_image_url: string | null;
  published_at: string | null;
};

const POST_CATEGORY_LABEL: Record<string, string> = {
  culture: "カルチャー",
  product: "プロダクト",
  team: "チーム",
  event: "イベント",
  other: "その他",
};

function CompanyPostsSection({ posts }: { posts: CompanyPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section
      id="posts"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <SecTitle
          iconColor="purple"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          }
        >
          企業からの投稿
        </SecTitle>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "var(--purple)",
          background: "var(--purple-soft)", border: "1px solid #e9d5ff",
          padding: "2px 10px", borderRadius: 100, fontFamily: "Inter, sans-serif",
          flexShrink: 0,
        }}>
          {posts.length}件
        </span>
      </div>
      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.map((post) => {
          const catLabel = post.category ? (POST_CATEGORY_LABEL[post.category] ?? post.category) : null;
          const bodyPreview = post.body ? post.body.replace(/[#*`>\-]/g, "").trim().slice(0, 120) : null;
          return (
            <div key={post.id} style={{
              border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
              background: "#fff", display: "flex", flexDirection: "column", gap: 0,
            }}>
              {post.cover_image_url && (
                <div style={{ position: "relative", height: 160, background: "var(--bg-tint)", flexShrink: 0 }}>
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              )}
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                {catLabel && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 100,
                    background: "var(--purple-soft)", color: "var(--purple)",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                    width: "fit-content",
                  }}>
                    {catLabel}
                  </span>
                )}
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.5, fontFamily: "var(--font-noto-serif)" }}>
                  {post.title}
                </h3>
                {bodyPreview && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                    {bodyPreview}
                    {post.body && post.body.length > 120 ? "…" : ""}
                  </p>
                )}
                {post.published_at && (
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                    {new Date(post.published_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Company Articles Section ─────────────────────────────────────────────────

function CompanyArticlesSection({ articles, company }: { articles: Article[]; company: Company }) {
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
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
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
        {articles.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            padding: "2px 10px", borderRadius: 100, fontFamily: "Inter, sans-serif",
            flexShrink: 0,
          }}>
            {articles.length}件
          </span>
        )}
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
            {articles.length === 1 ? (
              /* ── 1件の時: 左60%記事 + 右40% CTAパネル ── */
              (() => {
                const article = articles[0];
                const badge = TYPE_BADGE[article.type];
                const authorName = article.subject?.name ?? article.subjects?.[0]?.name;
                return (
                  <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                    {/* 左: 記事カード (60%) */}
                    <Link key={article.slug} href={`/articles/${article.slug}`} style={{ textDecoration: "none", display: "block", flex: "0 0 60%", minWidth: 0 }}>
                      <div className="article-card" style={{
                        border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden",
                        background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s", height: "100%",
                      }}>
                        <div style={{
                          height: 140,
                          background: article.eyecatch_gradient,
                          display: "flex", flexDirection: "column", justifyContent: "flex-end",
                          padding: "12px 16px",
                          position: "relative",
                        }}>
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,15,60,0.50)" }} />
                          <div style={{ position: "absolute", top: 12, left: 14, zIndex: 1 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 100, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700 }}>
                              {badge.label}
                            </span>
                          </div>
                          <div style={{ position: "absolute", top: 12, right: 14, fontSize: 10, color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif", fontWeight: 600, zIndex: 1 }}>
                            {article.read_min} min
                          </div>
                          <p style={{ position: "relative", zIndex: 1, margin: 0, fontFamily: "var(--font-noto-serif)", fontSize: 14, fontWeight: 800, lineHeight: 1.55, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.35)" }}>
                            {article.title}
                          </p>
                        </div>
                        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          {authorName ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--royal-50)", border: "2px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--royal)", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                {authorName.slice(0, 1)}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{authorName}</span>
                            </div>
                          ) : <div />}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 7, background: "var(--royal)", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            記事を読む
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                    {/* 右: もっと知るパネル (40%) */}
                    <div style={{ flex: "0 0 40%", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>
                        もっと知る
                      </div>
                      {[
                        { href: "#jobs", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>, label: "求人を見る", sub: `${company.job_count > 0 ? company.job_count + "件掲載中" : ""}` },
                        { href: `/companies/${company.id}/casual-meeting`, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: "カジュアル面談", sub: "選考なし・無料" },
                        { href: "/articles", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, label: "他の取材記事", sub: "OPINIO記事一覧" },
                      ].map(({ href, icon, label, sub }) => (
                        <a key={label} href={href} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, background: "#fff", border: "1px solid var(--line)", transition: "border-color 0.15s, background 0.15s" }} className="article-side-cta">
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--royal-50)", border: "1px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--royal)", flexShrink: 0 }}>
                            {icon}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{label}</div>
                            {sub && <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 1 }}>{sub}</div>}
                          </div>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ── 2件以上: リスト表示 ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {displayed.map((article) => {
                  const badge = TYPE_BADGE[article.type];
                  const icon  = TYPE_EYECATCH_ICON[article.type];
                  return (
                    <Link key={article.slug} href={`/articles/${article.slug}`} style={{ textDecoration: "none" }}>
                      <div
                        style={{
                          border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
                          background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s",
                          display: "flex", flexDirection: "row", alignItems: "stretch",
                        }}
                        className="article-card"
                      >
                        <div style={{
                          width: 110, flexShrink: 0,
                          background: article.eyecatch_gradient,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative",
                        }}>
                          {/* Royal overlay */}
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,35,102,0.18)", mixBlendMode: "multiply" }} />
                          <span style={{ fontSize: 32, opacity: 0.3, position: "relative", zIndex: 1 }}>{icon}</span>
                          <div style={{ position: "absolute", bottom: 7, right: 7, fontSize: 9, color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", fontWeight: 500, zIndex: 1 }}>
                            {article.read_min} min
                          </div>
                        </div>
                        <div style={{ padding: "12px 16px", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 100, background: badge.bg, color: badge.color, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>
                              {badge.label}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontFamily: "var(--font-noto-serif)", fontSize: 13, fontWeight: 700, lineHeight: 1.6, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                            {article.title}
                          </p>
                          {(article.subject?.name ?? (article.subjects && article.subjects[0]?.name)) && (
                            <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)" }}>
                              {article.subject?.name ?? article.subjects?.[0]?.name}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", paddingRight: 14, color: "var(--ink-mute)", flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {articles.length > 1 && (
              <div style={{ marginTop: "var(--space-4)", textAlign: "right" }}>
                <Link href="/articles" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)",
                  textDecoration: "none", fontFamily: "Inter, sans-serif",
                }}>
                  記事一覧を見る ({articles.length}件)
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── MobileBottomCTA ── γ-7: モバイル固定底部バー (< 768px) ──────────────────
function MobileBottomCTA({ company }: { company: Company }) {
  const hasMeeting = company.accepting_casual_meetings === true;
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
            background: hasMeeting ? "transparent" : "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
            color: hasMeeting ? "var(--royal)" : "#fff",
            border: hasMeeting ? "1.5px solid var(--royal)" : "none",
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
  currentEmployees: _currentEmployees = [],
  allEmployees = [],
}: {
  company: Company;
  detail: CompanyDetail;
  currentEmployees?: CompanyEmployee[];
  allEmployees?: CompanyEmployee[];
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
        const hasMeeting = company.accepting_casual_meetings === true;
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

      {/* 社員・OBにDMウィジェット */}
      {allEmployees.length > 0 && (
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "16px",
          boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
            💬 社員・OBに直接DMできます
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
            {allEmployees.slice(0, 5).map((emp, i) => (
              <a key={emp.userId} href={`/u/${emp.userId}`}
                style={{ display: "block", marginLeft: i === 0 ? 0 : -8, position: "relative", zIndex: 5 - i, flexShrink: 0 }}>
                {emp.avatarUrl ? (
                  <img src={emp.avatarUrl} alt={emp.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #fff" }} />
                ) : (
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: emp.avatarGradient || "linear-gradient(135deg,var(--royal),#3B5FD9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff", border: "2px solid #fff",
                  }}>
                    {emp.avatarInitial || emp.name.charAt(0)}
                  </div>
                )}
              </a>
            ))}
            <span style={{ marginLeft: 10, fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
              {allEmployees.length}名登録中
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.5 }}>
            求人票に書けないリアルを、直接聞けます
          </div>
          <a href="/auth" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", padding: "9px 0", borderRadius: 8,
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            background: "var(--royal)", color: "#fff",
            boxSizing: "border-box",
          }}>
            無料登録してDMを送る →
          </a>
        </div>
      )}

      {/* 申し込みの流れ — コンパクト1行表示 */}
      {company.accepting_casual_meetings === true && (
        <div
          style={{
            background: "var(--bg-tint)",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <p style={{
            margin: 0,
            fontSize: 12,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}>
            💬 気軽に話すだけでOK。選考なし・完全無料。
          </p>
          <p style={{
            margin: "4px 0 0",
            fontSize: 11,
            color: "var(--ink-mute)",
            lineHeight: 1.5,
          }}>
            フォーム1分 → 担当者から連絡 → 日程調整 → 面談（約30分）
          </p>
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
              { key: "従業員数", value: company.employee_count ? (() => { const s = String(company.employee_count); return s.includes("名") ? s : s + "名"; })() : "", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              { key: "所在地", value: detail.hq, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
              { key: "最寄り駅", value: detail.nearestStation ?? "—", isUnset: !detail.nearestStation, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M4 14h16"/><path d="M9 4v16"/><path d="M15 4v16"/></svg> },
              { key: "設立", value: detail.established, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { key: "代表者", value: detail.ceo, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              ...(detail.url ? [{ key: "公式サイト", value: detail.url, isLink: true, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }] : []),
            ] as { key: string; value: string; icon: React.ReactNode; isLink?: boolean; isUnset?: boolean }[]
          )
            .filter((item) => !item.isUnset && item.value && item.value !== "—")
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

  // auth + all DB queries in parallel (auth no longer blocks data fetching)
  const [authResult, companyResult, photos, recruiters, companyArticles, employees, companyPosts] = await Promise.all([
    supabase.auth.getUser(),
    getCompanyByIdCached(params.id),
    getCompanyPhotosCached(params.id),
    getCompanyRecruitersCached(params.id),
    getArticlesByCompany(params.id),
    getCompanyEmployeesCached(params.id),
    createAdminClient()
      .from("ow_company_posts")
      .select("id, title, body, category, cover_image_url, published_at")
      .eq("company_id", params.id)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .then((r: { data: CompanyPost[] | null }) => r.data ?? []),
  ]);

  const authUser = authResult.data.user;
  const isAuthenticated = !!authUser;

  // ow_users lookup (needs auth result, runs after)
  const owUserResult = isAuthenticated
    ? await supabase.from("ow_users").select("id").eq("auth_id", authUser!.id).maybeSingle()
    : { data: null, error: null };

  if (!companyResult) return notFound();

  const { company, detail, employeeCategories } = companyResult;
  const pageJobItems = detail.jobs.flatMap((c) => c.items);

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
      <Hero company={company} detail={detail} initialBookmarked={initialBookmarked} isAuthenticated={isAuthenticated} recruiters={recruiters} coverPhotoUrl={photos[0]?.image_url ?? null} />

      <div style={{ background: "var(--bg-tint)", minHeight: "60vh" }}>
        <CompanyStickyNav items={[
          { id: "about",            label: "企業概要" },
          ...(company.job_count > 0 ? [{ id: "jobs", label: `求人 ${company.job_count}件` }] : []),
          ...((detail.benefits?.length || detail.evaluationSystem) ? [{ id: "benefits", label: "働く環境" }] : []),
          ...((detail.fit_positives?.length || (detail.fit_negatives?.length && detail.show_fit_negatives)) ? [{ id: "fit", label: "向いている人" }] : []),
          ...((detail.reality_disclosure?.notFor || detail.reality_disclosure?.turnoverReasons?.length || detail.reality_disclosure?.onboardingGaps) ? [{ id: "reality", label: "リアル開示" }] : []),
          ...(detail.orgTeams && detail.orgTeams.length > 0 ? [{ id: "org-teams", label: "組織" }] : []),
          ...((detail.main_products?.length || detail.main_customers?.length || detail.customer_cases?.length) ? [{ id: "products-clients", label: "製品・顧客" }] : []),
          ...(employees.current.length > 0 || employees.alumni.length > 0 ? [{ id: "current-employees", label: `社員・OB/OG` }] : []),
          ...(companyPosts.length > 0 ? [{ id: "posts", label: `投稿 ${companyPosts.length}件` }] : []),
          ...(companyArticles.length > 0 ? [{ id: "articles", label: `記事 ${companyArticles.length}件` }] : []),
          { id: "salary", label: "給与データ" },
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

            {/* 3. 募集中の求人 */}
            <JobsSection company={company} detail={detail} />

            {/* 4. 福利厚生・評価制度 */}
            <BenefitsSection detail={detail} />

            {/* 4b. 向いている人 */}
            <FitSection detail={detail} />

            {/* 4c. リアル開示 */}
            <RealityDisclosureSection detail={detail} />

            {/* Mid-page CTA after Benefits */}
            {company.accepting_casual_meetings && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                padding: "14px 20px", borderRadius: 12, marginBottom: "var(--space-6)",
                background: "linear-gradient(135deg,#FEF3C7 0%,#FDE68A 100%)",
                border: "1px solid #FCD34D",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", lineHeight: 1.5 }}>
                    働く環境を読んだら、次は実際の声を聞いてみませんか？
                  </div>
                  <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>選考なし・完全無料のカジュアル面談</div>
                </div>
                <Link href={`/companies/${company.id}/casual-meeting`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                  padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#fff",
                  textDecoration: "none", whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
                }}>
                  話を聞く →
                </Link>
              </div>
            )}

            {/* 4. 組織体制 */}
            <OrgTeamsSectionClient detail={detail} companyId={company.id} jobCount={company.job_count} />

            {/* ⑧ Mid-page CTA after OrgTeams */}
            {company.job_count > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                padding: "14px 20px", borderRadius: 12, marginBottom: "var(--space-6)",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", lineHeight: 1.5 }}>
                    組織体制を理解したら、求人で具体的なポジションを確認しましょう
                  </div>
                </div>
                <a href="#jobs" style={{
                  display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                  padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: "var(--royal)", color: "#fff",
                  textDecoration: "none", whiteSpace: "nowrap",
                }}>
                  求人を見る（{company.job_count}件）
                </a>
              </div>
            )}

            {/* 5. 製品・顧客 */}
            <ProductsClientsSection detail={detail} company={company} />

            {/* 6. 社員の声（キャッチフレーズ） */}
            <EmployeeVoicesSection employees={employees.current} />

            {/* 7. 現役社員・OBOGプロフィール */}
            <CurrentEmployeesSection employees={employees.current} categories={employeeCategories} />
            {employees.alumni.length > 0 && <AlumniSection alumni={employees.alumni} />}

            {/* 8. 記事（OPINIO取材記事） */}
            {/* 企業投稿 */}
            <CompanyPostsSection posts={companyPosts} />

            <CompanyArticlesSection articles={companyArticles} company={company} />

            {/* ── 給与データ ── */}
            <SalaryDataSection companyId={company.id} companyName={company.name} jobs={pageJobItems} />

            {/* ── ページ末尾CTA ── */}
            {company.accepting_casual_meetings && (
              <div style={{
                background: "#fff",
                borderRadius: 18,
                padding: "28px 32px",
                marginBottom: "var(--space-6)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                border: "2px solid #FDE68A",
                boxShadow: "0 4px 24px rgba(245,158,11,0.12)",
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#B45309", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
                    NEXT STEP
                  </div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", lineHeight: 1.4 }}>
                    気になったら、気軽に話してみませんか？
                  </h3>
                  <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                    選考なし・完全無料。転職意欲がなくても大丈夫です。
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {company.job_count > 0 && (
                    <a
                      href="#jobs"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                        background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff",
                        textDecoration: "none",
                        boxShadow: "0 3px 12px rgba(245,158,11,0.35)",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
                      求人を見る ({company.job_count}件)
                    </a>
                  )}
                  <Link
                    href={`/companies/${company.id}/casual-meeting`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "12px 22px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      background: "transparent", color: "var(--royal)",
                      border: "1.5px solid var(--royal)",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--royal)", animation: "cta-pulse 1.8s ease-in-out infinite", flexShrink: 0, display: "inline-block" }} />
                    話を聞く（カジュアル面談）
                  </Link>
                </div>
              </div>
            )}

            {recruiters.length > 0 && (
              <RecruitersSection recruiters={recruiters} />
            )}


          </main>

          <Sidebar company={company} detail={detail} currentEmployees={employees.current} allEmployees={[...employees.current, ...employees.alumni]} />
        </div>
      </div>

      {/* γ-7: モバイル固定底部バー (< 768px) */}
      <MobileBottomCTA company={company} />

      <style suppressHydrationWarning>{`
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
        .article-side-cta:hover {
          border-color: var(--royal-100) !important;
          background: var(--royal-50) !important;
        }

        /* ── Pulse for CTA dot ── */
        @keyframes cta-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        /* ── Org expand button hover ── */
        .org-expand-btn:hover { background: #001a52 !important; opacity: 0.92; }

        /* ── Nav no-scrollbar ── */
        nav::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
