import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { type PositionMember } from "@/app/jobs/mockJobData";
import { getJobBySlugOrId, getJobPositionMembers, type JobPositionMember } from "@/lib/supabase/queries";

const getJobBySlugOrIdCached = cache(getJobBySlugOrId);
import { createClient } from "@/lib/supabase/server";
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { JobMobileStickyBar } from "@/components/jobs/JobMobileStickyBar";
import { JobInlineShare } from "@/components/jobs/JobShareButton";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { isSalesJob, getSalesSegmentLabel, getHunterFarmerLabel } from "@/lib/constants/salesFields";

// 5分間ページキャッシュ（ISR）
export const revalidate = 60;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getJobBySlugOrIdCached(params.id);
  if (!result) notFound();
  const { job, company, slug: jobSlug } = result;
  const canonicalId = jobSlug ?? params.id;

  const salaryText = job.salary_min && job.salary_max
    ? `年収${job.salary_min}〜${job.salary_max}万円`
    : job.salary_min ? `年収${job.salary_min}万円〜` : "";

  const description = [
    job.highlight ?? `${company.name}の${job.role}求人`,
    salaryText,
    job.work_style,
    "IT/SaaS業界の求人はOPINIOで。",
  ].filter(Boolean).join("｜");

  const ogImageUrl = `/api/og?type=job&name=${encodeURIComponent(job.role)}&sub=${encodeURIComponent(company.name)}&badge=${encodeURIComponent(job.dept ?? "")}`;

  return {
    title: { absolute: `${job.role} — ${company.name} | OPINIO` },
    description,
    alternates: { canonical: `/jobs/${canonicalId}` },
    keywords: [job.role, company.name, job.dept ?? "", "IT転職", "SaaS転職", salaryText].filter(Boolean),
    openGraph: {
      title: `${job.role} — ${company.name} | OPINIO`,
      description,
      type: "website",
      url: `/jobs/${canonicalId}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${job.role} — ${company.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${job.role} — ${company.name} | OPINIO`,
      description,
      images: [ogImageUrl],
    },
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RelatedJob = {
  id: string;
  slug?: string | null;
  title: string;
  companyName: string;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SecTitle({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  // Map solid color → pastel bg / colored fg (matches companies/[id] pattern)
  const iconBgMap: Record<string, string> = {
    "var(--royal)":   "var(--royal-50)",
    "var(--accent)":  "var(--royal-50)",
    "var(--success)": "var(--success-soft,#ECFDF5)",
    "var(--purple)":  "var(--purple-soft,#F3E8FF)",
    "var(--warm)":    "var(--warm-soft,#FEF3C7)",
    "var(--ink)":     "var(--bg-tint,#F8FAFC)",
    "var(--ink-mute)":"var(--bg-tint,#F8FAFC)",
    "#0891B2":        "#E0F2FE",
  };
  const iconFgMap: Record<string, string> = {
    "var(--royal)":   "var(--royal)",
    "var(--accent)":  "var(--accent)",
    "var(--success)": "var(--success)",
    "var(--purple)":  "var(--purple)",
    "var(--warm)":    "#B45309",
    "var(--ink)":     "var(--ink-soft)",
    "var(--ink-mute)":"var(--ink-mute)",
    "#0891B2":        "#0891B2",
  };
  const iconBg = iconBgMap[color] ?? "var(--royal-50)";
  const iconFg = iconFgMap[color] ?? color;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "var(--space-3)",
      marginBottom: "var(--space-4)",
      fontFamily: "var(--font-noto-serif)",
      fontWeight: 700,
      fontSize: "var(--text-lg)",
      color: "var(--ink)",
      letterSpacing: "0.01em",
      lineHeight: 1.3,
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: iconBg,
        color: iconFg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "var(--text-base)",
      }}>
        {icon}
      </span>
      {children}
    </div>
  );
}

function RelatedJobsSection({ jobs }: { jobs: RelatedJob[] }) {
  if (jobs.length === 0) return null;
  return (
    <section style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 16, padding: "var(--space-6)", marginBottom: "var(--space-4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)" }}>同じ職種の求人</h2>
        <Link href="/jobs" style={{ fontSize: 12, color: "var(--royal)", textDecoration: "none", fontWeight: 600 }}>
          すべて見る →
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {jobs.map((rj) => (
          <Link key={rj.id} href={`/jobs/${rj.slug ?? rj.id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 14, padding: "var(--space-3) 14px", borderRadius: 10, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
            <CompanyLogo
              name={rj.companyName}
              logoUrl={rj.logoUrl}
              logoLetter={rj.logoLetter}
              logoGradient={rj.logoGradient}
              size={40}
              borderRadius={8}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rj.title}</div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{rj.companyName}</div>
            </div>
            {(rj.salaryMin || rj.salaryMax) && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", flexShrink: 0 }}>
                {rj.salaryMin && rj.salaryMax ? `${rj.salaryMin}〜${rj.salaryMax}万円` : rj.salaryMin ? `${rj.salaryMin}万円〜` : `〜${rj.salaryMax}万円`}
              </div>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5}><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status, label }: { status: PositionMember["status"]; label: string }) {
  const styles = {
    current: { bg: "var(--success-soft)", color: "var(--success)", border: "#A7F3D0" },
    moved: { bg: "var(--warm-soft, #FEF3C7)", color: "var(--warm, #F59E0B)", border: "#FDE68A" },
    alumni: { bg: "var(--purple-soft, #F5F3FF)", color: "var(--purple)", border: "#E9D5FF" },
  };
  const s = styles[status];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function PositionMembersSection({ members, jobCategory }: { members: JobPositionMember[]; jobCategory: string }) {
  if (members.length === 0) return null;
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: "var(--purple-soft,#F3E8FF)", color: "var(--purple)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </span>
        <div>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
            このポジションを経験した先輩
          </h2>
          <p style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            {jobCategory} の経験者に話を聞けます
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {members.map((m) => (
          <div key={m.userId} style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            padding: "12px 14px", borderRadius: 10,
            background: "var(--bg-tint)", border: "1px solid var(--line)",
          }}>
            {/* Avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: m.photoUrl ? "#f8fafc" : m.gradient,
              border: "2px solid #fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16, fontWeight: 700,
            }}>
              {m.photoUrl
                ? <img src={m.photoUrl} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : m.initial}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)" }}>{m.name}</span>
                {m.isCurrent && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 100,
                    background: "var(--success-soft)", color: "var(--success)", border: "1px solid #A7F3D0",
                    letterSpacing: "0.04em",
                  }}>
                    現職
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 11.5, color: "var(--ink-mute)", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {m.roleTitle}
              </div>
            </div>

            {/* CTA */}
            <Link
              href={`/u/${m.userId}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
                padding: "6px 12px", borderRadius: 8,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)",
                fontSize: 11.5, fontWeight: 700, textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              プロフィール
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          </div>
        ))}
      </div>

    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const result = await getJobBySlugOrIdCached(params.id);
  if (!result) notFound();

  const { job, company, relatedJobs, resolvedId, slug: jobSlug } = result;

  // UUID → slug 308 redirect
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
  if (isUUID && jobSlug) { permanentRedirect(`/jobs/${jobSlug}`); }

  const jobId = resolvedId;

  const initial = company.name.charAt(0).toUpperCase();

  // Position members — people with matching role experience
  const positionMembers = await getJobPositionMembers(job.dept ?? "");

  // Auth + bookmark state
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;
  let initialBookmarked = false;
  if (user) {
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (owUser) {
      const { data: bmark } = await supabase
        .from("ow_bookmarks")
        .select("id")
        .eq("user_id", owUser.id)
        .eq("target_type", "job")
        .eq("target_id", job.id)
        .maybeSingle();
      initialBookmarked = !!bmark;
    }
  }

  // Fetch same-category jobs from other companies
  const sameCategoryJobs: RelatedJob[] = [];
  if (job.dept) {
    const { data: sameCatRaw } = await supabase
      .from("ow_jobs")
      .select("id, slug, title, job_category, salary_min, salary_max, company_id, updated_at, ow_companies!inner(id, name, logo_url, logo_letter, logo_gradient)")
      .in("status", ["published", "active"])
      .eq("job_category", job.dept)
      .neq("id", jobId)
      .order("updated_at", { ascending: false })
      .limit(3);

    if (sameCatRaw) {
      for (const row of sameCatRaw as unknown as Array<{
        id: string;
        slug?: string | null;
        title: string;
        salary_min: number | null;
        salary_max: number | null;
        ow_companies: { name: string; logo_url: string | null; logo_letter: string | null; logo_gradient: string | null };
      }>) {
        const c = row.ow_companies;
        sameCategoryJobs.push({
          id: row.id,
          slug: row.slug ?? null,
          title: row.title,
          companyName: c.name,
          logoUrl: c.logo_url,
          logoLetter: c.logo_letter,
          logoGradient: c.logo_gradient,
          salaryMin: row.salary_min,
          salaryMax: row.salary_max,
        });
      }
    }
  }

  // 年収レンジコンテキスト計算（レンジ幅 ≥200万のとき表示）
  const salaryMin = job.salary_min ?? 0;
  const salaryMax = job.salary_max ?? 0;
  const showSalaryContext = salaryMin > 0 && salaryMax > 0 && salaryMax - salaryMin >= 200;
  const salaryMidpoint = showSalaryContext ? Math.round((salaryMin + salaryMax) / 2) : 0;
  const salaryMidPct = showSalaryContext
    ? Math.round(((salaryMidpoint - salaryMin) / (salaryMax - salaryMin)) * 100)
    : 50;

  return (
    <>
      <ReadingProgress />
      {(() => {
        // published_at が null の求人は JSON-LD を出力しない。
        // created_at フォールバックは使用しない（2026-06-12 のデータ移行日が全件に入るため）。
        if (!job.published_at) return null;

        // description: catch_copy + overview + required_skills を結合。空なら出力しない。
        const descParts: string[] = [];
        if (job.highlight) descParts.push(`<p>${job.highlight}</p>`);
        if (job.overview) descParts.push(`<p>${job.overview}</p>`);
        if (job.required_skills.length > 0) {
          descParts.push(`<p>必須要件</p><ul>${job.required_skills.map((s) => `<li>${s}</li>`).join("")}</ul>`);
        }
        const description = descParts.join("");
        if (!description) return null;

        const isFullRemote = job.work_style.includes("フルリモート");

        const jsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: job.role,
          identifier: {
            "@type": "PropertyValue",
            name: company.name,
            value: jobSlug ?? jobId,
          },
          hiringOrganization: {
            "@type": "Organization",
            name: company.name,
            sameAs: `https://opinio.jp/companies/${company.slug ?? job.company_id}`,
          },
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressCountry: "JP",
              addressLocality: job.location || "東京",
            },
          },
          ...(isFullRemote ? {
            jobLocationType: "TELECOMMUTE",
            applicantLocationRequirements: { "@type": "Country", name: "JP" },
          } : {}),
          baseSalary: job.salary_min ? {
            "@type": "MonetaryAmount",
            currency: "JPY",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salary_min * 10000,
              ...(job.salary_max ? { maxValue: job.salary_max * 10000 } : {}),
              unitText: "YEAR",
            },
          } : undefined,
          datePosted: job.published_at,
          ...(job.expires_at ? { validThrough: job.expires_at } : {}),
          employmentType: job.employment_type ?? "FULL_TIME",
          description,
          url: `https://opinio.jp/jobs/${jobSlug ?? jobId}`,
        };

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
          />
        );
      })()}
      {/* Breadcrumb */}
      <nav aria-label="パンくずリスト" style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "var(--space-2) 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
            <span>/</span>
            <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>求人を探す</Link>
            <span>/</span>
            <span aria-current="page" style={{ color: "var(--ink-soft)" }}>{job.role}</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "var(--space-6) 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.gradient}
              size={64}
              borderRadius={14}
              style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 6, flexWrap: "wrap" }}>
                <Link href={`/companies/${company.id}`} style={{ fontSize: "var(--text-base)", color: "var(--royal)", fontWeight: 700 }}>
                  {company.name}
                </Link>
                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {company.industry}{company.employee_count != null ? ` · ${company.employee_count.toLocaleString()}名` : ""}
                </span>
              </div>

              {/* HOT badge */}
              {job.urgency === "hot" && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 6, marginBottom: "var(--space-2)",
                  background: "#FEE2E2", color: "#DC2626",
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
                  fontFamily: "Inter, sans-serif", border: "1px solid #FECACA",
                }}>
                  🔥 積極採用中
                </div>
              )}

              <h1 style={{
                fontFamily: 'var(--font-noto-serif)',
                fontSize: "clamp(18px,2vw,24px)", fontWeight: 700,
                color: "var(--ink)", lineHeight: 1.4, marginBottom: "var(--space-2)",
                letterSpacing: "0.01em",
              }}>
                {job.role}
              </h1>

              {/* ② Salary — always shown; 給与非公開の場合はその旨を明示 */}
              <div style={{ marginBottom: "var(--space-2)" }}>
                {/* セールス職の場合は基本給 + OTE を並べて表示 */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {(job.salary_min || job.salary_max) ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 14px", borderRadius: 100,
                  background: "var(--success-soft)", border: "1px solid #A7F3D0",
                  color: "var(--success)", fontSize: 15, fontWeight: 700,
                  fontFamily: "Inter, sans-serif",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  {job.salary_min && job.salary_max
                    ? `${job.salary_min}〜${job.salary_max}万円`
                    : job.salary_min ? `${job.salary_min}万円〜`
                    : `〜${job.salary_max}万円`}
                </span>
                ) : (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 14px", borderRadius: 100,
                  background: "var(--line-soft)", border: "1px solid var(--line)",
                  color: "var(--ink-mute)", fontSize: 13, fontWeight: 500,
                }}>
                  給与非公開
                </span>
                )}
                {/* OTE ピル（営業職かつ入力あり） */}
                {isSalesJob(job.dept) && (job.ote_min || job.ote_max) && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 14px", borderRadius: 100,
                    background: "#EFF6FF", border: "1px solid #BFDBFE",
                    color: "#1D4ED8", fontSize: 15, fontWeight: 700,
                    fontFamily: "Inter, sans-serif",
                  }}>
                    OTE&nbsp;{job.ote_min && job.ote_max
                      ? `${job.ote_min}〜${job.ote_max}万円`
                      : job.ote_min ? `${job.ote_min}万円〜`
                      : `〜${job.ote_max}万円`}
                  </span>
                )}
                </div>

              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {[job.employment_type, job.work_style, job.location, job.experience].filter(Boolean).map((b) => (
                  <span key={b} style={{
                    display: "inline-flex", alignItems: "center",
                    fontSize: 11.5, fontWeight: 600, padding: "5px 11px",
                    background: "#fff", border: "1px solid var(--line)", borderRadius: 100,
                    color: "var(--ink)",
                  }}>
                    {b}
                  </span>
                ))}
              </div>

              {/* ⑦ Inline share — small icons below tags */}
              <JobInlineShare jobId={job.id} jobTitle={job.role} companyName={company.name} />
            </div>
          </div>
        </div>
      </div>

      {/* スクロール検知スティッキーCTA — ヒーロー直下にセンチネルを置き、通過後に表示 */}
      <JobMobileStickyBar
        casualHref={company.jobs_public ? `/companies/${company.slug ?? job.company_id}/casual-meeting?job_id=${job.id}` : undefined}
        applyHref={`/jobs/${job.id}/apply`}
      />

      {/* Body */}
      <div style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          <div className="grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]">

            {/* ── Main column ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

              {/* ⑩ この求人のポイント — catch_copy を冒頭に強調 */}
              {job.highlight && (
              <section style={{
                background: "linear-gradient(135deg, #f0f4ff 0%, var(--royal-50) 100%)",
                border: "1.5px solid var(--royal-100)",
                borderRadius: 14, padding: "var(--space-6)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                  fontSize: 11, fontWeight: 800, color: "var(--royal)", letterSpacing: "0.08em",
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, background: "var(--royal)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </span>
                  この求人のポイント
                </div>
                <p style={{
                  fontFamily: 'var(--font-noto-serif)',
                  fontSize: "var(--text-base)", fontWeight: 600,
                  color: "var(--ink)", lineHeight: 1.85, margin: 0,
                }}>
                  {job.highlight}
                </p>
              </section>
              )}

              {/* Overview → 仕事内容 */}
              {job.overview && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8"/>
                  </svg>
                }>
                  仕事内容
                </SecTitle>
                <p style={{ fontSize: "var(--text-base)", color: "var(--ink-soft)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{job.overview}</p>
              </section>
              )}

              {/* Skills */}
              {(job.required_skills.length > 0 || job.preferred_skills.length > 0) && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--warm)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                }>
                  必須スキル / 歓迎スキル
                </SecTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
                  <div style={{ padding: "var(--space-4)", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-3)",
                      fontSize: 11, fontWeight: 800, color: "#B45309", letterSpacing: "0.05em",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                      </svg>
                      必須スキル
                    </div>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      {job.required_skills.map((s, i) => (
                        <li key={i} style={{ display: "flex", gap: "var(--space-2)", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }}>
                            <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                          </svg>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ padding: "var(--space-4)", borderRadius: 10, background: "var(--royal-50)", border: "1px solid var(--royal-100)" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-3)",
                      fontSize: 11, fontWeight: 800, color: "var(--royal)", letterSpacing: "0.05em",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      歓迎スキル
                    </div>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      {job.preferred_skills.map((s, i) => (
                        <li key={i} style={{ display: "flex", gap: "var(--space-2)", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }}>
                            <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                          </svg>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              )}

              {/* 勤務条件 */}
              {(job.salary_min || job.salary_max || job.location || job.work_style || job.employment_type) && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--success)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                }>
                  勤務条件
                </SecTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {/* 年収 / OTE */}
                  {(job.salary_min || job.salary_max) && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    {/* 基本給行 */}
                    <div style={{ padding: "16px 20px", borderRadius: isSalesJob(job.dept) && (job.ote_min || job.ote_max) ? "12px 12px 0 0" : 12, background: "var(--royal-50)", border: "1px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                          </svg>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
                          {isSalesJob(job.dept) ? "基本給" : "想定年収"}
                        </span>
                      </div>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>
                        {job.salary_min && job.salary_max
                          ? `${job.salary_min}〜${job.salary_max}万円`
                          : job.salary_min ? `${job.salary_min}万円〜`
                          : `〜${job.salary_max}万円`}
                      </span>
                    </div>
                    {/* OTE行（営業職かつ入力あり） */}
                    {isSalesJob(job.dept) && (job.ote_min || job.ote_max) && (
                    <div style={{ padding: "14px 20px", borderRadius: "0 0 12px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderTop: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 7, background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                          </svg>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8" }}>OTE（目標達成時）</span>
                      </div>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "#1D4ED8", fontFamily: "Inter, sans-serif" }}>
                        {job.ote_min && job.ote_max
                          ? `${job.ote_min}〜${job.ote_max}万円`
                          : job.ote_min ? `${job.ote_min}万円〜`
                          : `〜${job.ote_max}万円`}
                      </span>
                    </div>
                    )}
                  </div>
                  )}
                  {/* セールス専用: 担当セグメント・新規/既存 */}
                  {isSalesJob(job.dept) && ((job.sales_segment?.length ?? 0) > 0 || job.sales_hunter_farmer || job.incentive_note) && (
                  <div style={{ gridColumn: "1 / -1", padding: "16px 20px", borderRadius: 12, background: "#F8FAFC", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "var(--royal)", color: "#fff" }}>営業職</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>担当領域・インセンティブ</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {(job.sales_segment ?? []).map((seg) => (
                        <span key={seg} style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 100, background: "#DBEAFE", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                          {getSalesSegmentLabel(seg)}
                        </span>
                      ))}
                      {job.sales_hunter_farmer && (
                        <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>
                          {getHunterFarmerLabel(job.sales_hunter_farmer)}
                        </span>
                      )}
                    </div>
                    {job.incentive_note && (
                      <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                        {job.incentive_note}
                      </p>
                    )}
                  </div>
                  )}
                  {/* 勤務地 */}
                  {job.location && (
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>勤務地</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{job.location}</span>
                  </div>
                  )}
                  {/* 働き方 */}
                  {job.work_style && (
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                      </svg>
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>働き方</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{job.work_style}</span>
                  </div>
                  )}
                  {/* 雇用形態 */}
                  {job.employment_type && (
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      </svg>
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>雇用形態</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{job.employment_type}</span>
                  </div>
                  )}
                  {/* 職種 */}
                  {job.dept && (
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                      </svg>
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>職種</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{job.dept}</span>
                  </div>
                  )}
                </div>
              </section>
              )}

              {/* Position members — 0件のときは非表示 */}
              {job.position_members.length > 0 && <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: "var(--space-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: "var(--royal)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </span>
                    <h2 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--ink)" }}>
                      {company.name}でこの職種を経験した人
                      <span style={{ fontFamily: "Inter, sans-serif", color: "var(--royal)", marginLeft: 6 }}>
                        {job.position_members.length}名
                      </span>
                    </h2>
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
                  過去・現在に関わらず、{company.name}でこの職種を経験したOpinio登録者です。
                  <strong style={{ color: "var(--ink-soft)" }}>現在のステータス</strong>もあわせて表示しています。
                </p>

                {/* Avatar row */}
                <div style={{ display: "flex", marginBottom: "var(--space-4)" }}>
                  {job.position_members.map((m, i) => (
                    <div key={i} style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: m.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: "var(--text-base)", fontWeight: 700,
                      border: "2.5px solid #fff",
                      marginLeft: i === 0 ? 0 : -10,
                      position: "relative", zIndex: 10 - i,
                    }}>
                      {m.initial}
                    </div>
                  ))}
                </div>

                {/* Interview cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {job.position_members.map((m, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px var(--space-4)",
                      background: "var(--bg-tint)", border: "1px solid var(--line)",
                      borderRadius: 10,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                        background: m.gradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: "var(--text-sm)", fontWeight: 700,
                        }}>
                        {m.initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-noto-serif)',
                          fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--ink)",
                          lineHeight: 1.5, marginBottom: 4,
                        }}>
                          「{m.catch}」
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--ink-mute)" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <path d="M14 2v6h6"/>
                          </svg>
                          {m.name} · {m.period} · {m.date}
                        </div>
                      </div>
                      <StatusBadge status={m.status} label={m.status_label} />
                    </div>
                  ))}
                </div>

                {/* Status legend */}
                <div style={{
                  marginTop: "var(--space-4)", paddingTop: 14, borderTop: "1px solid var(--line-soft)",
                  display: "flex", flexWrap: "wrap", gap: "var(--space-3)", fontSize: 11, color: "var(--ink-mute)",
                }}>
                  {[
                    { dot: "var(--success)", label: "現役・現職継続" },
                    { dot: "#F59E0B", label: "現役・異動済み" },
                    { dot: "var(--purple)", label: "OBOG" },
                  ].map(({ dot, label }) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                      {label}
                    </span>
                  ))}
                </div>
              </section>}

              {/* Main tasks */}
              {job.main_tasks.length > 0 && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="#0891B2" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                }>
                  メイン業務
                </SecTitle>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {job.main_tasks.map((task, i) => (
                    <li key={i} style={{ display: "flex", gap: "var(--space-2)", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                        background: "var(--royal-50)", color: "var(--royal)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, fontFamily: "Inter, sans-serif",
                      }}>
                        {i + 1}
                      </span>
                      {task}
                    </li>
                  ))}
                </ul>
              </section>
              )}


              {/* 入社後90日 */}
              {job.first_90_days && (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", marginBottom: 0, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
                <div style={{ padding: "var(--space-4) var(--space-6) var(--space-3)", background: "var(--royal-50)", borderBottom: "1px solid var(--royal-100)", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--royal)" }}>入社後90日でやること</span>
                </div>
                <div style={{ padding: "var(--space-4) var(--space-6)", fontSize: "var(--text-base)", color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                  {job.first_90_days}
                </div>
              </div>
              )}

              {/* チーム構成 */}
              {job.team_composition && (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", marginBottom: 0, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
                <div style={{ padding: "var(--space-4) var(--space-6) var(--space-3)", background: "#f5faf2", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--success)" }}>チーム構成</span>
                </div>
                <div style={{ padding: "var(--space-4) var(--space-6)", fontSize: "var(--text-base)", color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                  {job.team_composition}
                </div>
              </div>
              )}

              {/* なぜ今採用するか */}
              {job.why_hire && (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", marginBottom: 0, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
                <div style={{ padding: "var(--space-4) var(--space-6) var(--space-3)", background: "var(--warm-soft)", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#B45309" }}>なぜ今採用するか</span>
                </div>
                <div style={{ padding: "var(--space-4) var(--space-6)", fontSize: "var(--text-base)", color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                  {job.why_hire}
                </div>
              </div>
              )}

              {/* Selection flow */}
              {job.selection_flow.length > 0 && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--purple)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                }>
                  選考フロー
                </SecTitle>
                <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
                  {job.selection_flow.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "var(--space-3) 14px",
                        background: i === 0 ? "var(--royal-50)" : i === job.selection_flow.length - 1 ? "var(--success-soft)" : "var(--bg-tint)",
                        border: `1px solid ${i === 0 ? "var(--royal-100)" : i === job.selection_flow.length - 1 ? "#A7F3D0" : "var(--line)"}`,
                        borderRadius: 10, minWidth: 88, textAlign: "center" as const,
                      }}>
                        <div style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 4,
                          color: i === 0 ? "var(--royal)" : i === job.selection_flow.length - 1 ? "var(--success)" : "var(--ink-mute)",
                        }}>
                          {step.step}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{step.name}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{step.meta}</div>
                      </div>
                      {i < job.selection_flow.length - 1 && (
                        <div style={{ padding: "0 6px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5}>
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {job.selection_note && (
                <p style={{
                  marginTop: 14, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7,
                  background: "var(--bg-tint)", padding: "var(--space-2) 14px", borderRadius: 8,
                  borderLeft: "3px solid var(--royal-100)",
                }}>
                  {job.selection_note}
                </p>
                )}
              </section>
              )}

              {/* Related article */}
              {job.related_article_title && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--ink)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8"/>
                  </svg>
                }>
                  関連する取材レポート
                </SecTitle>
                {(
                  <div style={{
                    display: "flex", gap: 14, padding: "14px var(--space-4)",
                    border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-tint)",
                  }}>
                    <div style={{
                      width: 80, height: 60, borderRadius: 8, flexShrink: 0,
                      background: company.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6, fontSize: 10,
                        color: "var(--ink-mute)", marginBottom: 5, fontWeight: 600,
                      }}>
                        <span style={{ padding: "2px 7px", borderRadius: 4, background: "var(--success-soft)", color: "var(--success)" }}>
                          編集部取材
                        </span>
                        {company.name}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, marginBottom: 4 }}>
                        {job.related_article_title}
                      </div>
                      <div style={{
                        fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      } as React.CSSProperties}>
                        {job.related_article_excerpt}
                      </div>
                    </div>
                  </div>
                )}
              </section>
              )}

              {/* Company summary */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  </svg>
                }>
                  企業について
                </SecTitle>

                {/* ⑥ Mission statement — Wantedly style */}
                {company.mission && (
                <div style={{
                  padding: "16px 20px", borderRadius: 12, marginBottom: "var(--space-3)",
                  background: "linear-gradient(135deg, var(--royal-50) 0%, #EEF4FF 100%)",
                  borderLeft: "4px solid var(--royal)",
                }}>
                  <p style={{
                    fontFamily: 'var(--font-noto-serif)', fontSize: 14, fontWeight: 600,
                    color: "var(--royal)", lineHeight: 1.75, margin: 0,
                  }}>
                    {company.mission}
                  </p>
                </div>
                )}

                {/* Logo + info card */}
                <div style={{
                  display: "flex", gap: "var(--space-4)", alignItems: "flex-start",
                  padding: "var(--space-4)", background: "var(--bg-tint)", borderRadius: 12,
                }}>
                  <CompanyLogo
                    name={company.name}
                    logoUrl={company.logo_url}
                    logoLetter={company.logo_letter}
                    logoGradient={company.gradient}
                    size={52}
                    borderRadius={12}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap",
                      fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)", marginBottom: 5,
                    }}>
                      {company.name}
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 100,
                        background: "var(--warm-soft)", color: "#B45309", fontWeight: 600,
                      }}>
                        {company.phase}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-4)", fontSize: 11, color: "var(--ink-mute)", flexWrap: "wrap" }}>
                      <span>業種 <strong style={{ color: "var(--ink)" }}>{company.industry}</strong></span>
                      <span>従業員 <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{company.employee_count?.toLocaleString() ?? "—"}</strong>名</span>
                    </div>
                  </div>
                </div>

                {/* ⑥ Fit positives — こんな人に向いている */}
                {company.fit_positives && company.fit_positives.length > 0 && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em",
                    marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    こんな人に向いている
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {company.fit_positives.slice(0, 4).map((fp, i) => (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                        background: "var(--success-soft)", color: "var(--success)", border: "1px solid #A7F3D0",
                      }}>
                        {fp}
                      </span>
                    ))}
                  </div>
                </div>
                )}

                {/* ⑥ Prominent CTA to company page */}
                <Link
                  href={`/companies/${company.id}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                    marginTop: "var(--space-4)", padding: "13px var(--space-6)",
                    background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                    color: "var(--royal)", borderRadius: 10,
                    fontSize: "var(--text-sm)", fontWeight: 700, textDecoration: "none",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  </svg>
                  {company.name} の企業ページで詳細を見る →
                </Link>
              </section>

              {/* Position members — role-matched alumni/current employees */}
              <PositionMembersSection members={positionMembers} jobCategory={job.dept ?? ""} />

              {/* Related jobs */}
              {relatedJobs.length > 0 && (
                <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                  <SecTitle color="var(--accent)" icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <rect x="2" y="7" width="20" height="14" rx="2"/>
                      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    </svg>
                  }>
                    {company.name}の他の求人
                  </SecTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--space-2)" }}>
                    {relatedJobs.map((rj) => (
                      <Link key={rj.id} href={`/jobs/${rj.slug ?? rj.id}`} style={{
                        display: "flex", gap: "var(--space-3)", alignItems: "flex-start",
                        padding: 14, border: "1px solid var(--line)", borderRadius: 10,
                        background: "var(--bg-tint)", textDecoration: "none",
                        transition: "border-color 0.2s, transform 0.2s",
                      }}
                        className="similar-job-card"
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: company.gradient,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: "var(--text-base)", fontWeight: 700,
                        }}>
                          {initial}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 3 }}>
                            {rj.role}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                            {(rj.salary_min || rj.salary_max)
                              ? `${rj.salary_min && rj.salary_max ? `${rj.salary_min}〜${rj.salary_max}万円` : rj.salary_min ? `${rj.salary_min}万円〜` : `〜${rj.salary_max}万円`} · `
                              : ""}{rj.work_style}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              {/* Same-category jobs from other companies */}
              <RelatedJobsSection jobs={sameCategoryJobs} />

            </div>

            {/* ── Sidebar ── */}
            <aside className="hidden lg:flex" style={{ flexDirection: "column", gap: "var(--space-4)", alignSelf: "flex-start", position: "sticky", top: 80 }}>
              {/* CTA */}
              <div style={{
                background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,35,102,0.08)",
              }}>
                {/* Header strip */}
                <div style={{
                  background: "linear-gradient(135deg, #001233 0%, var(--royal) 100%)",
                  padding: "16px var(--space-6)",
                }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.6)", marginBottom: 4, fontWeight: 500 }}>
                    {company.name}
                  </div>
                  <div style={{ fontSize: "var(--text-sm)", color: "#fff", fontWeight: 700, lineHeight: 1.45 }}>
                    {job.role}
                  </div>
                </div>

                <div style={{ padding: "var(--space-4) var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {/* ③ Primary: カジュアル面談 — warm orange, OPINIO思想に合わせてトップに */}
                  {company.jobs_public && (
                    <Link href={`/companies/${company.slug ?? job.company_id}/casual-meeting?job_id=${job.id}`} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                      width: "100%", padding: "15px var(--space-6)",
                      background: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
                      color: "#fff", borderRadius: 10,
                      fontSize: "var(--text-base)", fontWeight: 700, textDecoration: "none", textAlign: "center",
                      boxShadow: "0 4px 16px rgba(245,158,11,0.38)",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      まず社員に話を聞く（無料）
                    </Link>
                  )}

                  {/* ③ Secondary: 応募する */}
                  <Link href={`/jobs/${job.id}/apply`} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                    width: "100%", padding: company.jobs_public ? "12px var(--space-6)" : "15px var(--space-6)",
                    background: company.jobs_public
                      ? "rgba(0,35,102,0.06)"
                      : "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
                    color: company.jobs_public ? "var(--royal)" : "#fff",
                    border: company.jobs_public ? "1.5px solid var(--royal-100)" : "none",
                    borderRadius: 10,
                    fontSize: company.jobs_public ? "var(--text-sm)" : "var(--text-base)",
                    fontWeight: 700, textDecoration: "none", textAlign: "center",
                    boxShadow: company.jobs_public ? "none" : "0 4px 16px rgba(0,35,102,0.28)",
                  }}>
                    この求人に応募する
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <BookmarkButton
                    targetType="job"
                    targetId={job.id}
                    label="気になるに追加"
                    initialBookmarked={initialBookmarked}
                    isAuthenticated={isAuthenticated}
                    variant="with-text"
                  />
                </div>
              </div>

              {/* Job summary */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-4)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 14 }}>
                  求人サマリー
                </div>
                {/* Salary — highlighted row */}
                {(job.salary_min || job.salary_max) && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-2)", borderRadius: 8,
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)", gap: "var(--space-2)",
                }}>
                  <span style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, flexShrink: 0 }}>想定年収</span>
                  <span style={{
                    fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--royal)",
                    fontFamily: "Inter, sans-serif", textAlign: "right" as const,
                  }}>
                    {job.salary_min && job.salary_max
                      ? `${job.salary_min}〜${job.salary_max}万円`
                      : job.salary_min ? `${job.salary_min}万円〜`
                      : `〜${job.salary_max}万円`}
                  </span>
                </div>
                )}
                {[
                  { key: "職種", value: job.dept },
                  { key: "雇用形態", value: job.employment_type },
                  { key: "勤務地", value: job.location },
                  { key: "働き方", value: job.work_style },
                  { key: "経験", value: job.experience },
                ].map(({ key, value }) => (
                  <div key={key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "var(--space-2) 0", borderBottom: "1px solid var(--line-soft, #F1F5F9)", gap: "var(--space-2)",
                  }}>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>{key}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textAlign: "right" as const }}>{value}</span>
                  </div>
                ))}
              </div>


            </aside>
          </div>
        </div>
      </div>

      <style>{`
        .similar-job-card:hover {
          border-color: var(--royal-100) !important;
          transform: translateY(-1px) !important;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </>
  );
}
