import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompanyById,
  getCompanyPhotos,
  getCompanyRecruiters,
  getArticlesByCompany,
  getCompanyEmployees,
} from "@/lib/supabase/queries";
import type { CompanyPhoto, CompanyRecruiter, CompanyEmployee, CompanyEmployeeCategoryItem } from "@/lib/supabase/queries";
import type { Article } from "@/app/articles/mockArticleData";
import { TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";
import type { Company } from "@/app/companies/mockCompanies";
import { formatUpdated } from "@/app/companies/mockCompanies";
import type { CompanyDetail, CompanyNumbers } from "@/app/companies/[id]/mockDetailData";
import { PhotoCarousel } from "./PhotoCarousel";
import BookmarkButton, { CompanyStickyNav } from "./CompanyDetailClient";
import EvaluationText from "./EvaluationText";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { BackToTop } from "@/components/jobseeker/BackToTop";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/jobseeker/PostCard";
import type { Database } from "@/lib/supabase/types";
import { resolveAvatarColor } from "@/lib/jobCategoryColors";
import { JOB_GROUPING_THRESHOLD } from "@/lib/constants";

type ExternalLink = Database["public"]["Tables"]["ow_company_external_links"]["Row"];

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getCompanyById(params.id);
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
        fontSize: 12,
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
      {/* Gradient cover band — taller for visual impact */}
      <div style={{ height: 210, background: company.gradient, position: "relative", overflow: "hidden" }}>
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
            gap: 32,
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          {/* Left: logo + info */}
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Logo — overlaps cover band */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 18,
                flexShrink: 0,
                marginTop: -52,
                position: "relative",
                zIndex: 1,
                background: company.logo_url ? "#fff" : company.gradient,
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
                <Image
                  src={company.logo_url}
                  alt={company.name}
                  width={96}
                  height={96}
                  style={{ objectFit: "contain", padding: 8 }}
                />
              ) : (
                company.logo_letter ?? initial
              )}
            </div>
            <div style={{ paddingTop: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  marginBottom: 5,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase" as const,
                }}
              >
                {company.industry}
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-noto-serif)',
                  fontWeight: 700,
                  fontSize: "clamp(22px,2.5vw,32px)",
                  color: "var(--ink)",
                  marginBottom: 6,
                  letterSpacing: "0.01em",
                  lineHeight: 1.25,
                }}
              >
                {company.name}
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "#334155",
                  lineHeight: 1.65,
                  marginBottom: 14,
                  maxWidth: 560,
                }}
              >
                {company.tagline}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {/* バッジ1: 従業員 */}
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 11px",
                    background: "var(--bg-tint)",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  {company.employee_count > 0
                    ? `従業員 ${company.employee_count.toLocaleString()}名`
                    : "従業員 —"}
                </span>
                {/* バッジ2: 創業 */}
                {(() => {
                  const year = parseInt(detail.established);
                  const age = !isNaN(year) ? new Date().getFullYear() - year : null;
                  return age !== null ? (
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 11px",
                        background: "var(--bg-tint)",
                        color: "var(--ink-soft)",
                        border: "1px solid var(--line)",
                        borderRadius: 100,
                        fontSize: 11,
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
                      gap: 5,
                      padding: "5px 11px",
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      border: "1px solid #A7F3D0",
                      borderRadius: 100,
                      fontSize: 11,
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
                      gap: 5,
                      padding: "5px 11px",
                      background: "var(--bg-tint)",
                      color: "var(--ink-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 100,
                      fontSize: 11,
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
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                    {chips.slice(0, 4).map(({ icon, label }) => (
                      <span
                        key={label}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "4px 10px",
                          background: "rgba(0,35,102,0.05)",
                          color: "var(--ink-soft)",
                          border: "1px solid rgba(0,35,102,0.1)",
                          borderRadius: 100,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        <span style={{ fontSize: 12 }}>{icon}</span>
                        {label}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right: bookmark + share */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, alignSelf: "flex-start", paddingTop: 14 }}>
            <BookmarkButton
              companyName={company.name}
              companyId={company.id}
              initialBookmarked={initialBookmarked}
              isAuthenticated={isAuthenticated}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(company.name + ' — ' + company.tagline)}&url=${encodeURIComponent('https://opinio.jp/companies/' + company.id)}`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "#000", color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
                X
              </a>
              <a href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent('https://opinio.jp/companies/' + company.id)}`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "#00B900", color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
                L
              </a>
            </div>
          </div>
        </div>

        {/* Stats grid — colored stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            paddingTop: 24,
            marginTop: 20,
            borderTop: "1px solid var(--line-soft)",
          }}
          className="[grid-template-columns:repeat(2,1fr)] sm:[grid-template-columns:repeat(4,1fr)]"
        >
          {[
            {
              iconBg: "var(--royal-50)",
              iconColor: "var(--royal)",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              ),
              label: "社員数",
              value: company.employee_count > 0 ? company.employee_count.toLocaleString() : "—",
              unit: company.employee_count > 0 ? "名" : "",
              sub: "直近公表値",
            },
            {
              iconBg: "#F3E8FF",
              iconColor: "#7C3AED",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                </svg>
              ),
              label: "事業ステージ",
              value: company.phase ?? "—",
              unit: "",
              sub: "",
              isText: true,
            },
            {
              iconBg: "#ECFDF5",
              iconColor: "#059669",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              ),
              label: "設立",
              value: detail.established || "—",
              unit: "",
              sub: "",
              isText: true,
            },
            {
              iconBg: "#FEF3C7",
              iconColor: "#D97706",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 10h18" />
                </svg>
              ),
              label: "募集中の求人",
              value: String(company.job_count),
              unit: "件",
              sub: company.job_count > 0 ? "現在公開中" : "",
            },
          ].map(({ iconBg, iconColor, icon, label, value, unit, sub, isText }) => (
            <div key={label} style={{
              padding: "16px 18px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid var(--line)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: iconBg, color: iconColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 1px 4px ${iconBg}`,
                }}>
                  {icon}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, fontFamily: "Inter, sans-serif" }}>
                  {label}
                </span>
              </div>
              <div
                style={{
                  fontFamily: isText ? "var(--font-noto-sans)" : "Inter, sans-serif",
                  fontSize: isText ? 17 : 26,
                  fontWeight: 800,
                  color: value === "—" ? "var(--ink-mute)" : "var(--ink)",
                  lineHeight: 1.1,
                  marginBottom: sub ? 5 : 0,
                  letterSpacing: isText ? "0.01em" : "-0.02em",
                }}
              >
                {value}
                {unit && (
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--ink-soft)",
                      fontWeight: 600,
                      marginLeft: 3,
                      letterSpacing: 0,
                    }}
                  >
                    {unit}
                  </span>
                )}
              </div>
              {sub && (
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 3, fontFamily: "Inter, sans-serif", letterSpacing: "0.03em" }}>{sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* Recruiter strip */}
        {recruiters.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            paddingTop: 16, marginTop: 16, borderTop: "1px solid var(--line-soft)",
          }}>
            <div style={{ display: "flex" }}>
              {recruiters.slice(0, 3).map((r, i) => (
                <div key={r.id} style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: r.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)",
                  border: "2.5px solid #fff",
                  marginLeft: i === 0 ? 0 : -10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                  boxShadow: "0 0 0 1px var(--line)",
                  position: "relative", zIndex: 3 - i,
                }}>
                  {r.avatar_initial || (r.name ?? "採").charAt(0)}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
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
        gap: 10,
        fontFamily: 'var(--font-noto-serif)',
        fontWeight: 700,
        fontSize: 22,
        color: "var(--ink)",
        letterSpacing: "0.02em",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: iconBg[iconColor],
          color: iconFg[iconColor],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
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
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header with subtle gradient */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
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
      <div style={{ padding: "22px 28px 28px" }}>

      {detail.mission && (
        <div
          style={{
            padding: "28px 32px",
            background: "linear-gradient(135deg, #0a1f4e 0%, #002366 60%, #1a3a8a 100%)",
            borderRadius: 14,
            marginBottom: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circles */}
          <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -20, bottom: -60, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
          {/* Left accent bar */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "linear-gradient(180deg, #F59E0B 0%, #3B5FD9 100%)", borderRadius: "14px 0 0 14px" }} />
          <div style={{ paddingLeft: 12 }}>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.45)",
                marginBottom: 12,
                textTransform: "uppercase" as const,
              }}
            >
              MISSION
            </div>
            <div
              style={{
                fontFamily: 'var(--font-noto-serif)',
                fontSize: "clamp(18px, 2.2vw, 23px)",
                fontWeight: 500,
                color: "#fff",
                lineHeight: 1.7,
                letterSpacing: "0.02em",
              }}
            >
              {detail.mission}
            </div>
          </div>
        </div>
      )}

      <PhotoCarousel photos={photos} />

      {detail.about && (
        <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.9, marginTop: 20 }}>
          {detail.about}
        </p>
      )}

      {/* Why Join — only if distinct from about/description */}
      {detail.why_join && (
        <div
          style={{
            marginTop: 24,
            padding: "20px 24px 20px 28px",
            borderLeft: "4px solid var(--royal)",
            background: "linear-gradient(135deg, #f8faff 0%, #eff3fc 100%)",
            borderRadius: "0 12px 12px 0",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--royal)",
              opacity: 0.7,
              marginBottom: 10,
              fontFamily: "Inter, sans-serif",
            }}
          >
            この会社に入社する理由
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.9,
              color: "var(--ink)",
              fontFamily: "var(--font-noto-serif)",
            }}
          >
            {detail.why_join}
          </p>
        </div>
      )}
      </div>
    </section>
  );
}

// ─── OpinioOpinionCard ── γ-6 修正⑤: 編集部の見立てカード（ヒーロー直下） ────

/** company_features[0] から最大 150 字の要約テキストを抽出する */
function getSummaryText(opinionFit: string[] | null | undefined): string | null {
  if (!opinionFit || opinionFit.length === 0) return null;
  const first = opinionFit[0];
  if (!first) return null;
  return first.length > 150 ? first.slice(0, 150) + "…" : first;
}

function OpinioOpinionCard({ detail }: { detail: CompanyDetail }) {
  const summary = getSummaryText(detail.company_features);
  // 未登録企業（company_features 空）はカード自体を非表示
  if (!summary) return null;

  return (
    <div
      className="px-4 py-3 sm:px-[26px] sm:py-[22px]"
      style={{
        background: "#042C53",
        borderRadius: 16,
        marginBottom: 20,
      }}
    >
      {/* バッジ */}
      <div style={{ marginBottom: 14 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.1em",
            color: "#B5D4F4",
            background: "rgba(181,212,244,0.12)",
            border: "1px solid rgba(181,212,244,0.25)",
            borderRadius: 100,
            padding: "3px 10px",
          }}
        >
          {/* 編集ペンアイコン */}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          編集部取材
        </span>
      </div>

      {/* 引用テキスト（イタリック体・白文字） */}
      <p
        style={{
          margin: "0 0 18px",
          fontSize: 14,
          fontStyle: "italic",
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.8,
          fontFamily: "var(--font-noto-serif)",
        }}
      >
        「{summary}」
      </p>

      {/* 「全文を読む →」ボタン (γ-7: タップ領域 minHeight 44px) */}
      <a
        href="#opinion"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 44,
          padding: "8px 16px",
          background: "rgba(255,255,255,0.08)",
          color: "#B5D4F4",
          border: "1px solid rgba(181,212,244,0.28)",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        全文を読む →
      </a>
    </div>
  );
}

function CompanyFeaturesSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  if (!detail.company_features.length) return null;

  const FEATURE_COLORS = [
    { bg: "var(--royal-50)", border: "var(--royal-100)", num: "var(--royal)" },
    { bg: "#F3E8FF", border: "#DDD6FE", num: "#7C3AED" },
    { bg: "#ECFDF5", border: "#A7F3D0", num: "#059669" },
    { bg: "#FEF3C7", border: "#FDE68A", num: "#D97706" },
    { bg: "var(--royal-50)", border: "var(--royal-100)", num: "var(--royal)" },
    { bg: "#F3E8FF", border: "#DDD6FE", num: "#7C3AED" },
  ];

  return (
    <section
      id="opinion"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          }
        >
          特徴
        </SecTitle>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, color: "var(--ink-mute)", fontWeight: 600,
          padding: "3px 10px", borderRadius: 100,
          background: "var(--bg-tint)", border: "1px solid var(--line)",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          編集部取材
        </span>
      </div>

      <div style={{ padding: "22px 28px 28px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {detail.company_features.map((item, i) => {
          const col = FEATURE_COLORS[i % FEATURE_COLORS.length];
          return (
          <div
            key={i}
            style={{
              background: col.bg,
              border: `1px solid ${col.border}`,
              borderRadius: 12,
              padding: "16px 18px",
              position: "relative",
            }}
          >
            <div style={{
              fontSize: 12, fontWeight: 800, fontFamily: "Inter, sans-serif",
              color: col.num, marginBottom: 8, opacity: 0.6,
            }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink)" }}>
              {item}
            </div>
          </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: "14px 18px",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)", display: "block", fontSize: 14, marginBottom: 2 }}>
            この見解、実際のところどうなのか。
          </strong>
          {company.name}で働いていた/いる先輩に、カジュアルに話を聞けます。
        </div>
        <Link
          href="/mentors"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            background: "var(--royal)",
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          先輩に相談する →
        </Link>
      </div>
      </div>
    </section>
  );
}

// ─── Fit Section ─────────────────────────────────────────────────────────────

function FitSection({ detail }: { detail: CompanyDetail }) {
  const hasFit = detail.fit_positives && detail.fit_positives.length > 0;
  const hasCaution = detail.fit_negatives && detail.fit_negatives.length > 0 && detail.show_fit_negatives !== false;
  if (!hasFit && !hasCaution) return null;

  return (
    <section
      id="fit"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
      }}>
        <SecTitle
          iconColor="green"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          }
        >
          OPINIO編集部より
        </SecTitle>
      </div>
      <div style={{ padding: "20px 32px 28px" }}>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 20 }}>
        企業へのヒアリングをもとにOPINIO編集部が整理しました。入社前のミスマッチ防止にお役立てください。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: (hasFit && hasCaution) ? "1fr 1fr" : "1fr", gap: 16 }} className="fit-grid">
        {/* 合う人 */}
        {hasFit && (
          <div style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 12,
            padding: "20px 22px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
              fontSize: 13, fontWeight: 800, color: "#15803D",
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "#16A34A", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              向いている人
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {detail.fit_positives!.map((item, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "#166534", lineHeight: 1.65 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    background: "#BBF7D0", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth={3}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 合わない人 */}
        {hasCaution && (
          <div style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 12,
            padding: "20px 22px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
              fontSize: 13, fontWeight: 800, color: "#92400E",
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "#F59E0B", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              慎重に検討ください
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {detail.fit_negatives!.map((item, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "#78350F", lineHeight: 1.65 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    background: "#FDE68A", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth={3}>
                      <line x1="15" y1="5" x2="5" y2="15" /><line x1="5" y1="5" x2="15" y2="15" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p style={{
        marginTop: 16, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
        borderTop: "1px solid var(--line-soft)", paddingTop: 14,
      }}>
        ※ 企業が入力した情報をもとにしています。最新情報は企業に直接ご確認ください。
      </p>

      <style>{`
        @media (max-width: 640px) { .fit-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      </div>
    </section>
  );
}

// ─── MentorCTAWidget ── メンター相談のみ（運営経由） ────────────────────────────

function MentorCTAWidget() {
  return (
    <Link
      href="/mentors"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        background: "linear-gradient(135deg, #FFFBEB 0%, var(--warm-soft) 100%)",
        border: "1.5px solid #FDE68A",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 20,
        textDecoration: "none",
        boxShadow: "0 2px 10px rgba(245,158,11,0.1)",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      className="mentor-cta-widget"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 10px rgba(245,158,11,0.3)",
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
            気になることは、OPINIOのメンターに相談
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            編集部が声がけした先輩が対応 · 30分・完全無料 · 運営が仲介します
          </div>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        fontSize: 12, fontWeight: 700, color: "#D97706",
        flexShrink: 0, whiteSpace: "nowrap" as const,
      }}>
        相談する
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </Link>
  );
}

// ─── MentorSuggestionBanner ──────────────────────────────────────────────────

function MentorSuggestionBanner({ companyName }: { companyName: string }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, var(--warm-soft) 0%, #FFFBEB 100%)",
      border: "none",
      borderRadius: 16,
      padding: "24px 28px",
      marginBottom: 24,
      boxShadow: "0 1px 3px rgba(245,158,11,0.08), 0 8px 28px rgba(245,158,11,0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
            気になる点は、先輩に直接聞いてみよう
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            {companyName} の現役・元社員メンターに30分・無料で相談できます
          </div>
        </div>
      </div>
      <Link
        href="/mentors"
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
          color: "#fff", textDecoration: "none",
          boxShadow: "0 3px 10px rgba(245,158,11,0.35)",
          flexShrink: 0, whiteSpace: "nowrap" as const,
        }}
      >
        先輩メンターを見る →
      </Link>
    </div>
  );
}

// ─── Benefits Section ─────────────────────────────────────────────────────────

function BenefitsSection({ detail }: { detail: CompanyDetail }) {
  const SUBHEADER_STYLE: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--ink-soft)",
    marginBottom: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  };
  // UNSET_STYLE removed — replaced by inline "カジュアル面談でご確認ください" badges

  return (
    <section
      id="benefits"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
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
      <div style={{ padding: "22px 28px 28px" }}>

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
      <div style={{ marginBottom: 28 }}>
        <div style={SUBHEADER_STYLE}>Benefits</div>
        {detail.benefits && detail.benefits.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                  fontSize: 13,
                  color: "var(--royal)",
                  fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{getBenefitIcon(b)}</span>
                {b}
              </span>
            ))}
          </div>
        ) : (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            fontSize: 12, color: "var(--ink-mute)",
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
        <div style={SUBHEADER_STYLE}>Evaluation</div>
        {detail.evaluationSystem ? (
          <EvaluationText text={detail.evaluationSystem} />
        ) : (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            fontSize: 12, color: "var(--ink-mute)",
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

function WorkStyleSection({ detail }: { detail: CompanyDetail }) {
  return (
    <section
      id="work-style"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
      }}>
        <SecTitle
          iconColor="warm"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 4v4M16 4v4" />
            </svg>
          }
        >
          働き方の選択肢
        </SecTitle>
      </div>
      <div style={{ padding: "22px 28px 28px" }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}
        className="[grid-template-columns:1fr] sm:[grid-template-columns:1fr_1fr]"
      >
        <div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-soft)",
              marginBottom: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Remote / Location
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {detail.work_location.map(({ label, note }, i) => (
              <div key={i}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: "var(--success-soft,#ECFDF5)",
                    border: "1px solid #A7F3D0",
                    borderRadius: 100,
                    fontSize: 13,
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {label}
                </span>
                {note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      marginTop: 6,
                      paddingLeft: 14,
                    }}
                  >
                    {note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-soft)",
              marginBottom: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Work Style
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {detail.work_style.map(({ label, note }, i) => (
              <div key={i}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: "var(--success-soft,#ECFDF5)",
                    border: "1px solid #A7F3D0",
                    borderRadius: 100,
                    fontSize: 13,
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {label}
                </span>
                {note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      marginTop: 6,
                      paddingLeft: 14,
                    }}
                  >
                    {note}
                  </div>
                )}
              </div>
            ))}

            {/* work_time_system — 常時表示、null は「未設定」(Commit BB) */}
            <div>
              {detail.workTimeSystem ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: "var(--success-soft,#ECFDF5)",
                    border: "1px solid #A7F3D0",
                    borderRadius: 100,
                    fontSize: 13,
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {detail.workTimeSystem}
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    padding: "8px 14px",
                    background: "var(--bg-tint)",
                    border: "1px solid var(--line)",
                    borderRadius: 100,
                    fontSize: 12,
                    color: "var(--ink-mute)",
                  }}
                >
                  勤務時間制度: —
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* workstyle_description — 常時表示、null は「未設定」(Commit BB) */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-soft)",
            marginBottom: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Working Style Note
        </div>
        {detail.workstyleDescription ? (
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, margin: 0 }}>
            {detail.workstyleDescription}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>—</p>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--ink-soft)",
          marginTop: 16,
          padding: "12px 14px",
          background: "var(--bg-tint)",
          borderRadius: 8,
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          lineHeight: 1.7,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          実際のリモート頻度や残業時間は部署・職種によって異なります。
          <strong style={{ color: "var(--royal)" }}>「先輩への相談」</strong>
          で、あなたが受ける可能性のあるポジションの実態をご確認ください。
        </div>
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
  const hasMentorCTA = employee.isMentor && employee.mentorId;

  const avatar = (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 6,
        background: avatarColor.bg,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-noto-serif)",
        fontWeight: 700,
        fontSize: 19,
        color: avatarColor.text,
      }}
    >
      {employee.avatarInitial}
    </div>
  );

  const nameAndRole = (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>
          {employee.name}
        </span>
        {employee.isMentor && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--purple)",
              background: "var(--purple-soft)",
              border: "1px solid #DDD6FE",
              borderRadius: 100,
              padding: "2px 8px",
              whiteSpace: "nowrap",
            }}
          >
            メンター
          </span>
        )}
      </div>
      {employee.roleTitle && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
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
      {showEndedAt && employee.endedAt && (
        <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
          退職: {employee.endedAt}
        </p>
      )}
    </div>
  );

  if (hasMentorCTA) {
    // <a> を入れ子にできないため、div ラッパー + 2 つの別 <a> に分割
    return (
      <div
        className="employee-card-link"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "var(--bg-tint)",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}
      >
        <a
          href={`/u/${employee.userId}`}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, textDecoration: "none", minWidth: 0 }}
        >
          {avatar}
          {nameAndRole}
        </a>
        <a
          href={`/mentors/${employee.mentorId}/reserve`}
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--royal)",
            background: "var(--royal-50)",
            border: "1px solid var(--royal-100)",
            textDecoration: "none",
            padding: "5px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}
        >
          相談する →
        </a>
      </div>
    );
  }

  return (
    <a
      href={`/u/${employee.userId}`}
      className="employee-card-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        textDecoration: "none",
      }}
    >
      {avatar}
      {nameAndRole}
    </a>
  );
}

const EMPLOYEE_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

// ─── CompanyPostsSection ─────────────────────────────────────────────────────

function CompanyPostsSection({
  companyId,
  posts,
  postsCount,
}: {
  companyId: string;
  posts: ExternalLink[];
  postsCount: number;
}) {
  return (
    <section
      id="posts"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
        >
          この企業の発信
        </SecTitle>
        {postsCount > 5 && (
          <Link
            href={`/companies/${companyId}/posts`}
            style={{ fontSize: 13, color: "var(--royal)", fontWeight: 500, textDecoration: "none" }}
          >
            すべて見る ({postsCount} 件) →
          </Link>
        )}
      </div>
      <div style={{ padding: "22px 28px 28px" }}>
      {/* PostCard 一覧 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {postsCount > 5 && (
        <Link
          href={`/companies/${companyId}/posts`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 16,
            padding: "10px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            color: "var(--royal)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
          className="company-posts-more-link"
        >
          発信をすべて見る ({postsCount} 件) →
        </Link>
      )}
      </div>
    </section>
  );
}

function CurrentEmployeesSection({
  employees,
  categories,
}: {
  employees: CompanyEmployee[];
  categories: CompanyEmployeeCategoryItem[];
}) {
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
    <section
      id="current-employees"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
      }}>
        <SecTitle icon={SECTION_ICON}>
          現役社員
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: 8,
            }}
          >
            ({employees.length}名)
          </span>
        </SecTitle>
      </div>
      <div style={{ padding: "22px 28px 28px" }}>
      {/* ── Role composition bar (3名以上 + カテゴリあり) ───────────────────── */}
      {employees.length >= 3 && categories.length > 0 && (() => {
        const catCounts = new Map<string, number>();
        for (const emp of employees) {
          const label = emp.roleParentName ?? emp.roleCategoryName ?? "その他";
          catCounts.set(label, (catCounts.get(label) ?? 0) + 1);
        }
        const entries = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]);
        const total = employees.length;
        const COLORS = ["#002366", "#3B5FD9", "#7C3AED", "#059669", "#F59E0B", "#DC2626", "#64748B"];
        return (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", height: 8, borderRadius: 100, overflow: "hidden", marginBottom: 10, gap: 2 }}>
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
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
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
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>
            社員プロフィールを準備中
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            OPINIO 取材メンバーが順次公開されます。<br />
            カジュアル面談で直接チームの声を聞けます。
          </div>
        </div>
      ) : categories.length === 0 ? (
        // カテゴリ設定なし → レスポンシブ列
        <div style={EMPLOYEE_GRID_STYLE} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)] lg:[grid-template-columns:repeat(3,1fr)]">
          {employees.map((emp) => (
            <EmployeeCard key={emp.userId} employee={emp} />
          ))}
        </div>
      ) : (
        // カテゴリ設定あり → 階層表示
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {group.parentName}
                  </span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      fontWeight: 400,
                      color: "var(--ink-mute)",
                    }}
                  >
                    {totalInGroup}名
                  </span>
                </div>

                {group.isParentDirect ? (
                  // 親直: 子見出しなしでグリッドを直接表示
                  <div style={EMPLOYEE_GRID_STYLE} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)] lg:[grid-template-columns:repeat(3,1fr)]">
                    {(empsByCategory.get(group.children[0].roleId) ?? []).map((emp) => (
                      <EmployeeCard key={emp.userId} employee={emp} />
                    ))}
                  </div>
                ) : (
                  // 子カテゴリあり: 子見出し + グリッド
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--ink-soft)",
                              }}
                            >
                              {cat.roleName}
                            </span>
                            <span
                              style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: 11,
                                fontWeight: 400,
                                color: "var(--ink-mute)",
                              }}
                            >
                              {empsInCat.length}名
                            </span>
                          </div>
                          <div style={EMPLOYEE_GRID_STYLE} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)] lg:[grid-template-columns:repeat(3,1fr)]">
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
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                その他
              </div>
              <div style={EMPLOYEE_GRID_STYLE} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)] lg:[grid-template-columns:repeat(3,1fr)]">
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
  );
}

// ─── AlumniCard ──────────────────────────────────────────────────────────────

function AlumniCard({ employee }: { employee: CompanyEmployee }) {
  const avatarColor = resolveAvatarColor(employee.roleParentId, employee.roleCategoryId);
  // "2022-11" → "2022.11" フォーマット変換
  const formattedEndedAt = employee.endedAt
    ? employee.endedAt.replace(/-/g, ".")
    : null;

  return (
    <a
      href={`/u/${employee.userId}`}
      className="employee-card-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        textDecoration: "none",
      }}
    >
      {/* アバター — EmployeeCard と同一スタイル */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          background: avatarColor.bg,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-noto-serif)",
          fontWeight: 700,
          fontSize: 19,
          color: avatarColor.text,
        }}
      >
        {employee.avatarInitial}
      </div>

      {/* 情報エリア */}
      <div style={{ minWidth: 0 }}>
        {/* 名前 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              whiteSpace: "nowrap",
            }}
          >
            {employee.name}
          </span>
        </div>

        {/* 役職 */}
        {employee.roleTitle && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
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

        {/* 退職時期 */}
        {formattedEndedAt && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--ink-mute)",
              marginTop: 2,
            }}
          >
            退職: {formattedEndedAt}
          </p>
        )}
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
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
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
              fontSize: 13,
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: 8,
            }}
          >
            ({alumni.length}名)
          </span>
        </SecTitle>
      </div>
      <div style={{ padding: "22px 28px 28px" }}>
      {alumni.length > 0 ? (
        <div style={EMPLOYEE_GRID_STYLE} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)] lg:[grid-template-columns:repeat(3,1fr)]">
          {alumni.map((emp) => (
            <AlumniCard key={emp.userId} employee={emp} />
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: "center", padding: "24px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
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
          <div style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>
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
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
        }}
      >
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--line-soft)", background: "linear-gradient(180deg, #fafbff 0%, #fff 100%)" }}>
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
        <div style={{ padding: "22px 28px 28px" }}>
          <p style={{ fontSize: 14, color: "var(--ink-mute)", textAlign: "center", padding: "24px 0", margin: 0 }}>
            現在、公開中の求人はありません。
          </p>
        </div>
      </section>
    );
  }

  // γ-4 修正③: 求人合計件数で表示モードを切り替え
  const totalJobs = detail.jobs.reduce((sum, cat) => sum + cat.total, 0);

  // 求人カード内の職種カラーバッジ (γ-4 修正②連携)
  function JobCatBadge({ catName, catId }: { catName: string; catId?: string }) {
    const color = resolveAvatarColor(catId ?? null, null);
    return (
      <span
        style={{
          display: "inline-block",
          fontSize: 10,
          padding: "2px 8px",
          borderRadius: 4,
          background: color.bg,
          color: color.text,
          fontWeight: 600,
        }}
      >
        {catName}
      </span>
    );
  }

  // 求人カード共通コンポーネント
  function JobCard({
    job,
    catName,
    catId,
    index,
  }: {
    job: { id?: string; title: string; salary: string; is_new?: boolean; urgency?: "open" | "hot" };
    catName: string;
    catId?: string;
    index: number;
  }) {
    const catColor = resolveAvatarColor(catId ?? null, null);
    return (
      <Link
        key={job.id ?? index}
        href={job.id ? `/jobs/${job.id}` : `/jobs?company=${company.id}`}
        style={{
          display: "flex",
          gap: 0,
          border: "1px solid var(--line)",
          borderRadius: 12,
          cursor: "pointer",
          background: "#fff",
          textDecoration: "none",
          overflow: "hidden",
          transition: "box-shadow 0.2s, transform 0.2s",
        }}
        className="job-item-link"
      >
        {/* Left accent bar in category color */}
        <div style={{ width: 4, flexShrink: 0, background: catColor.text, opacity: 0.7 }} />
        {/* Content */}
        <div style={{ flex: 1, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6, lineHeight: 1.35 }}>
              {job.title}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {job.urgency === "hot" && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "2px 7px", borderRadius: 4,
                  background: "#FEE2E2", color: "#DC2626",
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                  fontFamily: "Inter, sans-serif",
                  border: "1px solid #FECACA",
                }}>
                  🔥 HOT
                </span>
              )}
              {job.is_new && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--success-soft,#ECFDF5)", color: "var(--success)", fontWeight: 700, border: "1px solid #A7F3D0" }}>
                  新着
                </span>
              )}
              <JobCatBadge catName={catName} catId={catId} />
              {detail.work_location.length > 0 && (() => {
                const wl = detail.work_location[0].label;
                const isRemote = wl.includes("リモート") || wl.includes("在宅") || wl.includes("テレワーク") || wl.includes("フルリモート");
                return (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    fontSize: 10, padding: "2px 7px", borderRadius: 4,
                    background: isRemote ? "#f0fdf4" : "var(--bg-tint)",
                    color: isRemote ? "var(--success)" : "var(--ink-mute)",
                    border: `1px solid ${isRemote ? "#A7F3D0" : "var(--line)"}`,
                    fontWeight: 500,
                  }}>
                    {isRemote ? "🏠" : "🏢"} {wl}
                  </span>
                );
              })()}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            {job.salary && job.salary !== "—" && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>年収</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 800, color: "var(--success)" }}>
                  {job.salary}
                </div>
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "7px 14px", borderRadius: 8,
              background: "var(--royal-50)", color: "var(--royal)",
              border: "1px solid var(--royal-100)",
              fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            }}>
              詳細を見る
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    );
  }

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
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <SecTitle icon={sectionIcon}>
          募集中の求人
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
            · {company.job_count}件
          </span>
        </SecTitle>
        <Link
          href={`/companies/${company.id}/jobs`}
          style={{ color: "var(--royal)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}
        >
          すべての求人を見る →
        </Link>
      </div>
      <div style={{ padding: "22px 28px 28px" }}>
      {totalJobs < JOB_GROUPING_THRESHOLD ? (
        // ── 1〜3 件: カテゴリヘッダーなし、直接リスト (γ-4 修正③) ──────────
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {detail.jobs.flatMap((cat, ci) =>
            cat.items.map((job, ji) => (
              <JobCard
                key={job.id ?? `${ci}-${ji}`}
                job={job}
                catName={cat.cat}
                catId={cat.catId}
                index={ji}
              />
            ))
          )}
        </div>
      ) : (
        // ── 4 件以上: カテゴリグルーピング表示 (既存構造を維持) ────────────
        <>
          {detail.jobs.map((cat) => (
            <div key={cat.cat} style={{ marginBottom: 28 }}>
              {/* カテゴリヘッダー (既存スタイル維持) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  padding: "10px 16px",
                  background: "var(--royal-50)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  {cat.cat}
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
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
                    style={{ fontSize: 12, color: "var(--royal)", fontWeight: 500, textDecoration: "none" }}
                  >
                    すべて見る →
                  </Link>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cat.items.slice(0, 4).map((job, i) => (
                  <JobCard key={job.id ?? i} job={job} catName={cat.cat} catId={cat.catId} index={i} />
                ))}
              </div>
            </div>
          ))}

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Link
              href={`/companies/${company.id}/jobs`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 24px",
                background: "#fff",
                color: "var(--royal)",
                border: "1.5px solid var(--royal)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {company.job_count}件すべての求人を見る →
            </Link>
          </div>
        </>
      )}
      </div>
    </section>
  );
}

const AV_GRADIENTS = [
  "linear-gradient(135deg, #002366, #3B5FD9)",
  "linear-gradient(135deg, #F472B6, #DB2777)",
  "linear-gradient(135deg, #34D399, #059669)",
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
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
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
      <div style={{ padding: "22px 28px 28px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
        className="[grid-template-columns:repeat(2,1fr)] sm:[grid-template-columns:repeat(3,1fr)]"
      >
        {recruiters.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              gap: 14,
              padding: "16px 18px",
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
                fontSize: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              {r.avatar_initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
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
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.role_title}
                </div>
              )}
              {r.department && (
                <div style={{ fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.department}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "var(--bg-tint)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--ink-soft)",
          lineHeight: 1.7,
          display: "flex",
          alignItems: "center",
          gap: 8,
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

// ─── Company Articles Section ─────────────────────────────────────────────────

function CompanyArticlesSection({ articles }: { articles: Article[] }) {
  const displayed = articles.slice(0, 3);

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
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
      <div style={{ padding: "22px 28px 28px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {displayed.map((article) => {
          const badge = TYPE_BADGE[article.type];
          const icon  = TYPE_EYECATCH_ICON[article.type];
          return (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                className="article-card"
              >
                {/* Eyecatch */}
                <div
                  style={{
                    height: 100,
                    background: article.eyecatch_gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 36, opacity: 0.3 }}>{icon}</span>
                  <div
                    style={{
                      position: "absolute", top: 8, left: 10,
                      display: "inline-flex", alignItems: "center",
                      padding: "3px 8px", borderRadius: 100,
                      background: badge.bg, color: badge.color,
                      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em",
                    }}
                  >
                    {badge.label}
                  </div>
                  <div
                    style={{
                      position: "absolute", bottom: 7, right: 10,
                      fontSize: 9, color: "rgba(255,255,255,0.8)",
                      fontFamily: "Inter, sans-serif", fontWeight: 500,
                    }}
                  >
                    {article.read_min} min read
                  </div>
                </div>

                {/* Title */}
                <div style={{ padding: "12px 14px", flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-noto-serif)',
                      fontSize: 12, fontWeight: 700, lineHeight: 1.6,
                      color: "var(--ink)",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as React.CSSProperties}
                  >
                    {article.title}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {articles.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Link
            href="/articles"
            style={{
              fontSize: 12, color: "var(--accent)", textDecoration: "none",
              fontFamily: "Inter, sans-serif", fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            記事一覧を見る
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        </div>
      )}
      </div>
    </section>
  );
}

// ─── Numbers Section ──────────────────────────────────────────────────────────

const NUMBER_ITEMS: {
  label: string;
  key: keyof CompanyNumbers;
  format: (v: string | number) => string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
}[] = [
  { label: "平均年収", key: "avgSalary", format: (v) => String(v), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>, accentColor: "#059669", accentBg: "#ECFDF5" },
  { label: "平均年齢", key: "avgAge", format: (v) => `${v} 歳`, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, accentColor: "var(--royal)", accentBg: "var(--royal-50)" },
  { label: "有給取得率", key: "paidLeaveRate", format: (v) => `${v}%`, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, accentColor: "#7C3AED", accentBg: "#F3E8FF" },
  { label: "月間残業時間", key: "avgOvertimeHours", format: (v) => String(v), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, accentColor: "#D97706", accentBg: "#FEF3C7" },
  { label: "男女比", key: "genderRatio", format: (v) => String(v), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DB2777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, accentColor: "#DB2777", accentBg: "#FCE7F3" },
  { label: "累計調達額", key: "fundingTotal", format: (v) => String(v), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, accentColor: "#0891B2", accentBg: "#ECFEFF" },
];

function NumbersSection({ numbers, numbersUpdatedAt }: { numbers: CompanyNumbers; numbersUpdatedAt?: string | null }) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 18,
        border: "1px solid var(--line)",
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "22px 28px 18px",
        background: "#f5f8ff",
        borderBottom: "1px solid #dde4f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SecTitle
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
            }
          >
            数値で見る企業
          </SecTitle>
          {numbersUpdatedAt && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600,
              color: "var(--success)", padding: "3px 10px", borderRadius: 100,
              background: "var(--success-soft)", border: "1px solid #A7F3D0",
              marginLeft: 8,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              企業が直接回答 · {new Date(numbersUpdatedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
          企業アンケート回答
        </span>
      </div>
      <div style={{ padding: "22px 28px 28px" }}>
      {/* 全項目が未入力の場合は収集中メッセージ、一部でも入力済みならグリッド表示 */}
      {NUMBER_ITEMS.every(({ key }) => {
        const raw = numbers[key];
        return raw === null || raw === undefined || String(raw).trim() === "";
      }) ? (
        <div style={{
          padding: "20px 0 4px",
          fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          この企業の数値情報は現在収集中です。カジュアル面談や企業ページで直接確認いただけます。
        </div>
      ) : (
        <>
          {/* 3-column grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
            className="sm:grid-cols-3 grid-cols-2"
          >
            {NUMBER_ITEMS.map(({ label, key, format, icon, accentColor, accentBg }) => {
              const raw = numbers[key];
              const hasValue = raw !== null && raw !== undefined && String(raw).trim() !== "";
              const display = hasValue ? format(raw as string | number) : "—";

              return (
                <div
                  key={key}
                  style={{
                    background: hasValue ? "#fff" : "#fafafa",
                    border: `1px solid ${hasValue ? "var(--line)" : "#efefef"}`,
                    borderRadius: 12,
                    padding: "14px 16px 16px",
                    minHeight: 88,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    boxShadow: hasValue ? "0 1px 4px rgba(0,0,0,0.04)" : "none",
                  }}
                >
                  {/* Icon + Label row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {hasValue && (
                      <span style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        background: accentBg, display: "flex",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        {icon}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: hasValue ? "var(--ink-soft)" : "var(--ink-mute)",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {/* Value */}
                  <span
                    style={{
                      fontSize: hasValue ? 20 : 14,
                      fontWeight: hasValue ? 800 : 400,
                      fontFamily: hasValue ? "Inter, 'Noto Sans JP', sans-serif" : "'Noto Sans JP', sans-serif",
                      color: hasValue ? accentColor : "var(--ink-mute)",
                      lineHeight: 1.2,
                      letterSpacing: hasValue ? "-0.01em" : 0,
                    }}
                  >
                    {display}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              color: "var(--ink-mute)",
              lineHeight: 1.6,
            }}
          >
            企業が自己申告した値です。実態は求人ページ・カジュアル面談でご確認ください。
            「—」は企業が情報を公開していない項目です。
          </p>
        </>
      )}
      </div>
    </section>
  );
}

// ─── MobileBottomCTA ── γ-7: モバイル固定底部バー (< 768px) ──────────────────
function MobileBottomCTA({ company }: { company: Company }) {
  const hasMeeting = company.accepting_casual_meetings;
  const hasJobs = company.job_count > 0;
  if (!hasMeeting && !hasJobs) return null;

  return (
    <div
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
        padding: "12px 16px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
      }}
    >
      {hasMeeting && (
        <Link
          href={`/companies/${company.id}/casual-meeting`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 0",
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            color: "#fff",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
            marginBottom: hasJobs ? 8 : 0,
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
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
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
        gap: 16,
      }}
      className="hidden lg:flex"
    >
      {/* CTA card ── γ-2: 修正① CTA 優先順位逆転 */}
      {(() => {
        const hasMeeting = company.accepting_casual_meetings;
        const hasJobs = company.job_count > 0;
        return (
          <div
            style={{
              background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
              color: "#fff",
              padding: 22,
              borderRadius: 16,
              boxShadow: "0 12px 32px rgba(0,35,102,0.2)",
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                opacity: 0.72,
                marginBottom: 6,
                letterSpacing: "0.08em",
              }}
            >
              {company.name}
            </div>

            {/* Heading */}
            <div
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: 17,
                fontWeight: 500,
                marginBottom: 16,
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
                    gap: 8,
                    width: "100%",
                    padding: "14px 0",
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    color: "#fff",
                    borderRadius: 8,
                    fontSize: 15,
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
                    fontSize: 11,
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
                      fontSize: 12,
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
                  fontSize: 13,
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
                  fontSize: 12,
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
      {company.accepting_casual_meetings && (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 16,
              fontFamily: "Inter, sans-serif",
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
            <div key={n} style={{ display: "flex", gap: 12, position: "relative" }}>
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
                  fontSize: 13, fontWeight: i === 0 ? 600 : 500,
                  color: i === 0 ? "var(--ink)" : "var(--ink-soft)",
                  lineHeight: 1.35,
                }}>
                  {label}
                </div>
                {sub && (
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
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
          padding: 22,
          boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--ink-soft)",
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          Company Info
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* ジャンルチップ: 登録済み企業のみ表示、未登録は行ごと非表示 */}
          {company.genres.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "76px 1fr",
                gap: 10,
                fontSize: 13,
                alignItems: "flex-start",
                padding: "10px 0",
                borderBottom: "1px solid var(--line-soft)",
              }}
            >
              <span style={{ color: "var(--ink-soft)", fontSize: 11, fontWeight: 600, paddingTop: 3 }}>ジャンル</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {company.genres.map((g) => (
                  <span
                    key={g.id}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 14,
                      fontSize: 12,
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
              { key: "従業員数", value: company.employee_count ? `${company.employee_count.toLocaleString()}名` : "", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
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
                  gap: 8,
                  fontSize: 13,
                  alignItems: "flex-start",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                <span style={{ color: "var(--ink-soft)", fontSize: 11, fontWeight: 600, paddingTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
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
                      fontSize: 13,
                    }}
                  >
                    {value} →
                  </a>
                ) : isUnset ? (
                  <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{value}</span>
                ) : (
                  <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: 13 }}>{value}</span>
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

  const [companyResult, photos, recruiters, companyArticles, employees, authResult, postsResult, postsCountResult] = await Promise.all([
    getCompanyById(params.id),
    getCompanyPhotos(params.id),
    getCompanyRecruiters(params.id),
    getArticlesByCompany(params.id),
    getCompanyEmployees(params.id),
    supabase.auth.getUser(),
    // 企業発信リンク (公開中・実URL限定、最新 5 件)
    supabase
      .from("ow_company_external_links")
      .select("*")
      .eq("company_id", params.id)
      .eq("is_published", true)
      .not("url", "ilike", "%example.com%")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5),
    // 全件数 (もっと見るボタン用)
    supabase
      .from("ow_company_external_links")
      .select("*", { count: "exact", head: true })
      .eq("company_id", params.id)
      .eq("is_published", true)
      .not("url", "ilike", "%example.com%"),
  ]);

  const posts: ExternalLink[] = postsResult.data ?? [];
  const postsCount: number = postsCountResult.count ?? 0;

  if (!companyResult) return notFound();

  const { company, detail, employeeCategories } = companyResult;

  // Resolve ow_users.id and check existing bookmark
  let initialBookmarked = false;
  const isAuthenticated = !!authResult.data.user;
  if (isAuthenticated) {
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", authResult.data.user!.id)
      .maybeSingle();
    if (owUser) {
      const { data: bmark } = await supabase
        .from("ow_bookmarks")
        .select("id")
        .eq("user_id", owUser.id)
        .eq("target_type", "company")
        .eq("target_id", params.id)
        .maybeSingle();
      initialBookmarked = !!bmark;
    }
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
      <Breadcrumb company={company} />
      <Hero company={company} detail={detail} initialBookmarked={initialBookmarked} isAuthenticated={isAuthenticated} recruiters={recruiters} />
      <CompanyStickyNav items={[
        { id: "about",            label: "企業概要" },
        { id: "current-employees",label: employees.current.length > 0 ? `現役社員 ${employees.current.length}名` : "現役社員" },
        ...(employees.alumni.length > 0 ? [{ id: "alumni", label: `OB/OG ${employees.alumni.length}名` }] : []),
        ...(detail.company_features.length > 0 ? [{ id: "opinion", label: "特徴・評判" }] : []),
        ...((detail.fit_positives && detail.fit_positives.length > 0) || (detail.fit_negatives && detail.fit_negatives.length > 0) ? [{ id: "fit", label: "向き・不向き" }] : []),
        { id: "jobs",             label: company.job_count > 0 ? `求人 ${company.job_count}件` : "求人" },
        { id: "benefits",         label: "福利厚生" },
        { id: "work-style",       label: "働き方" },
      ]} />

      <div style={{ background: "var(--bg-tint)", minHeight: "60vh" }}>
        <div
          style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
          className="px-5 md:px-12 py-7 grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]"
        >
          {/* γ-7: モバイルで fixed bottom bar 分の余白を確保 */}
          <main className="pb-28 md:pb-0">
            {/* 1. 企業について */}
            <AboutSection
              detail={detail}
              photos={photos}
            />

            {/* 2. 企業の数値・働き方・福利厚生 */}
            <NumbersSection numbers={detail.numbers} numbersUpdatedAt={detail.numbersUpdatedAt} />
            <WorkStyleSection detail={detail} />
            <BenefitsSection detail={detail} />

            {/* 3. メンターCTA */}
            <MentorCTAWidget />

            {/* 4. OPINIO編集部より（現役社員の直上） */}
            <OpinioOpinionCard detail={detail} />

            {/* 5. 現役社員・OBOGプロフィール（閲覧のみ・直接連絡不可） */}
            <CurrentEmployeesSection employees={employees.current} categories={employeeCategories} />
            {employees.alumni.length > 0 && <AlumniSection alumni={employees.alumni} />}

            {/* 6. 特徴・評判・向き不向き */}
            <CompanyFeaturesSection company={company} detail={detail} />
            <FitSection detail={detail} />

            {/* 7. 発信・記事・採用担当 */}
            {posts.length > 0 && (
              <CompanyPostsSection
                companyId={params.id}
                posts={posts}
                postsCount={postsCount}
              />
            )}
            <MentorSuggestionBanner companyName={company.name} />
            {recruiters.length > 0 && (
              <RecruitersSection recruiters={recruiters} />
            )}
            {companyArticles.length > 0 && (
              <CompanyArticlesSection articles={companyArticles} />
            )}

            {/* 8. 募集中の求人（一番下） */}
            <JobsSection company={company} detail={detail} />
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
        .mentor-cta-widget:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245,158,11,0.18) !important;
        }
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
