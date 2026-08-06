import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { type PositionMember } from "@/app/jobs/mockJobData";
import { getJobBySlugOrId, getJobPositionMembers, getJobEmployees, getRoleTree, resolvePublishedCompanyHref, type JobPositionMember, type CompanyEmployee } from "@/lib/supabase/queries";

const getJobBySlugOrIdCached = cache(getJobBySlugOrId);
import { createClient } from "@/lib/supabase/server";
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { JobMobileStickyBar } from "@/components/jobs/JobMobileStickyBar";
import { JobInlineShare } from "@/components/jobs/JobShareButton";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { getSalesSegmentLabel, getHunterFarmerLabel } from "@/lib/constants/salesFields";
import { isBusinessRole } from "@/lib/roles/jobRoles";
import EvaluationText from "@/app/(jobseeker)/companies/[id]/EvaluationText";
import { fmtMan } from "@/lib/utils/salary";

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
    ? `年収${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
    : job.salary_min ? `年収${fmtMan(job.salary_min)}万円〜` : "";

  const description = [
    job.highlight ?? `${company.name}の${job.role}求人`,
    salaryText,
    job.work_style,
    "IT/SaaS業界の求人はOPINIOで。",
  ].filter(Boolean).join("｜");

  const ogImageUrl = `/api/og?type=job&name=${encodeURIComponent(job.role)}&sub=${encodeURIComponent(company.name)}&badge=${encodeURIComponent(job.roleLabel ?? "")}`;

  return {
    title: { absolute: `${job.role} — ${company.name} | OPINIO` },
    description,
    alternates: { canonical: `/jobs/${canonicalId}` },
    /* ⚠️ 会社呼称と標準職種名の両方を入れる。呼称だけにすると
          「エンジニア」のような標準職種名でのSEO流入を落とす */
    keywords: [job.role, company.name, job.companyRoleName ?? "", job.roleName ?? "", "IT転職", "SaaS転職", salaryText].filter(Boolean),
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
      fontSize: 18,
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
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)" }}>同じ職種の募集</h2>
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
            {/* ⚠️ 年収を横に並べない。
                   年収は折り返せないため flexShrink: 0 が必要で、12px だと約135px を占める。
                   375px の画面では見出しに 110px しか残らず「Enterp…」まで切り詰められ、
                   社名は3行に折り返していた（2026-08-04 実測）。縦に積めば全幅を使える。 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rj.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rj.companyName}</div>
              {(rj.salaryMin || rj.salaryMax) && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginTop: 2 }}>
                  {rj.salaryMin && rj.salaryMax ? `${fmtMan(rj.salaryMin)}〜${fmtMan(rj.salaryMax)}万円` : rj.salaryMin ? `${fmtMan(rj.salaryMin)}万円〜` : `〜${fmtMan(rj.salaryMax)}万円`}
                </div>
              )}
            </div>
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
      fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

// ── 求人詳細: 現役社員・OB/OG セクション ────────────────────────────────────

const JOB_AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "linear-gradient(135deg, #002366 0%, #3B5FD9 100%)", text: "rgba(255,255,255,0.9)" },
  { bg: "linear-gradient(135deg, #065F46 0%, #059669 100%)", text: "rgba(255,255,255,0.9)" },
  { bg: "linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)", text: "rgba(255,255,255,0.9)" },
  { bg: "linear-gradient(135deg, #92400E 0%, #F59E0B 100%)", text: "rgba(255,255,255,0.9)" },
  { bg: "linear-gradient(135deg, #1E40AF 0%, #0891B2 100%)", text: "rgba(255,255,255,0.9)" },
];

function JobEmployeeCard({ emp, companyId: _companyId }: { emp: CompanyEmployee; companyId: string }) {
  const colorIdx = emp.userId.charCodeAt(0) % JOB_AVATAR_COLORS.length;
  const color = JOB_AVATAR_COLORS[colorIdx];
  const initial = emp.avatarInitial ?? emp.name.charAt(0);

  return (
    <a
      href={`/u/${emp.userId}`}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 12,
        border: "1px solid var(--line)",
        background: "#fff",
        textDecoration: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      className="job-emp-card"
    >
      <div style={{
        width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
        background: emp.avatarUrl ? undefined : color.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 18,
        color: color.text, overflow: "hidden", border: "2px solid var(--line)",
      }}>
        {emp.avatarUrl ? (
          <img src={emp.avatarUrl} alt={emp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : initial}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</div>
        {emp.roleTitle && (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.roleTitle}</div>
        )}
        {emp.catchphrase && (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{emp.catchphrase}</div>
        )}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
    </a>
  );
}

function JobEmployeesSection({
  current,
  alumni,
  companyId,
  companyName,
  casualHref,
}: {
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
  companyId: string;
  companyName: string;
  /** 非公開企業では null。飛べない導線を置かないため CTA ごと出さない */
  casualHref: string | null;
}) {
  if (current.length === 0 && alumni.length === 0) return null;

  return (
    <>
      <style>{`
        .job-emp-card:hover { border-color: var(--royal-100) !important; box-shadow: 0 2px 8px rgba(0,35,102,0.08) !important; }
      `}</style>

      {/* 現役社員 */}
      {current.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--ink)" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--royal-50)", color: "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </span>
              この職種の現役メンバー
            </div>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>{current.length}名</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--space-2)" }}>
            {current.map((emp) => <JobEmployeeCard key={emp.userId} emp={emp} companyId={companyId} />)}
          </div>
          {casualHref && (
          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line-soft)" }}>
            <a
              href={casualHref}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "10px 20px", borderRadius: 10, width: "100%",
                background: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
                color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {companyName.replace(/^(株式会社|有限会社|合同会社)/, "").replace(/(株式会社|有限会社|合同会社)$/, "")}の社員に話を聞く（無料）
            </a>
          </div>
          )}
        </section>
      )}

      {/* OB/OG */}
      {alumni.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--ink)" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--purple-soft,#F3E8FF)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              この職種を経験したOB/OG
            </div>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>{alumni.length}名</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--space-2)" }}>
            {alumni.map((emp) => <JobEmployeeCard key={emp.userId} emp={emp} companyId={companyId} />)}
          </div>
        </section>
      )}
    </>
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
          <p style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, marginTop: 2 }}>
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
                    fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 100,
                    background: "var(--success-soft)", color: "var(--success)", border: "1px solid #A7F3D0",
                    letterSpacing: "0.04em",
                  }}>
                    現職
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, overflow: "hidden",
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
                fontSize: 12, fontWeight: 700, textDecoration: "none",
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

  // ⚠️ 企業ページへのリンクは env に関係なく is_published を見る。
  //    「求人は公開企業にしか紐づかない」は今そうなっているだけで、
  //    企業を非公開に戻せば崩れる（CLAUDE.md の原則）。null ならテキスト表示にする。
  const companyHref = await resolvePublishedCompanyHref(company.slug ?? company.id);

  // UUID → slug 308 redirect
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
  if (isUUID && jobSlug) { permanentRedirect(`/jobs/${jobSlug}`); }

  const jobId = resolvedId;

  const initial = company.name.charAt(0).toUpperCase();

  // ビジネス職（OTE・担当セグメントの表示対象）かどうかは ow_roles で判定する。
  // 旧実装は job_category のフリーテキストを Set 照合していたため、
  // 「エンタープライズ営業」は該当するのに「営業」は該当しない、といった穴があった。
  const jobRoleTree = await getRoleTree();
  const isBusinessJob = isBusinessRole(jobRoleTree, job.roleIds);

  // Position members — people with matching role experience
  const positionMembers = await getJobPositionMembers(job.dept ?? "");

  // 求人ロールに紐づいた現役社員・OBOG
  const jobEmployees = await getJobEmployees(job.company_id, job.role_category_id ?? null);

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

  // 同じ職種の他社求人。
  // 旧実装は job_category の完全一致だったため、「エンタープライズ営業」と「営業」が
  // 別物になり関連求人がほぼ出なかった。ow_job_roles で同じ職種を持つ求人を引く。
  const sameCategoryJobs: RelatedJob[] = [];
  const ownRoleIds = job.roleIds ?? [];
  if (ownRoleIds.length > 0) {
    const { data: siblingRoleRows } = await supabase
      .from("ow_job_roles")
      .select("job_id")
      .in("role_id", ownRoleIds)
      .neq("job_id", jobId);
    const siblingIds = Array.from(new Set((siblingRoleRows ?? []).map((r) => r.job_id as string)));

    const { data: sameCatRaw } = siblingIds.length > 0
      ? await supabase
          .from("ow_jobs")
          .select("id, slug, title, job_category, salary_min, salary_max, company_id, updated_at, ow_companies!inner(id, name, logo_url, logo_letter, logo_gradient)")
          .in("status", ["published", "active"])
          .in("id", siblingIds)
          .order("updated_at", { ascending: false })
          .limit(3)
      : { data: null };

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
            <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>募集</Link>
            <span>/</span>
            <span aria-current="page" style={{ color: "var(--ink-soft)" }}>{job.role}</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #eef3fd 0%, #f4f7fe 40%, #fafbff 75%, #fff 100%)", borderBottom: "1px solid var(--line)", padding: "var(--space-6) 0" }}>
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
                {companyHref ? (
                  <Link href={companyHref} style={{ fontSize: "var(--text-base)", color: "var(--royal)", fontWeight: 700 }}>
                    {company.name}
                  </Link>
                ) : (
                  <span style={{ fontSize: "var(--text-base)", color: "var(--ink)", fontWeight: 700 }}>{company.name}</span>
                )}
                <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
                  {company.industry}{company.employee_count != null ? ` · ${company.employee_count.toLocaleString()}名` : ""}
                </span>
              </div>

              {/* HOT badge */}
              {job.urgency === "hot" && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 6, marginBottom: "var(--space-2)",
                  background: "#FEE2E2", color: "#DC2626",
                  fontSize: 12, fontWeight: 800, letterSpacing: "0.08em",
                  fontFamily: "Inter, sans-serif", border: "1px solid #FECACA",
                }}>
                  🔥 積極採用中
                </div>
              )}

              <h1 style={{
                fontFamily: 'var(--font-noto-serif)',
                fontSize: "clamp(22px,3vw,32px)", fontWeight: 700,
                color: "var(--ink)", lineHeight: 1.4, marginBottom: "var(--space-2)",
                letterSpacing: "0.01em",
              }}>
                {job.role}
              </h1>

              {/* ② Salary — always shown; 給与非公開の場合はその旨を明示 */}
              <div style={{ marginBottom: "var(--space-2)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {(job.salary_min || job.salary_max) ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>想定年収</span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 14px", borderRadius: 100,
                    background: "var(--success-soft)", border: "1px solid #A7F3D0",
                    color: "var(--success)", fontSize: 15, fontWeight: 700,
                    fontFamily: "Inter, sans-serif",
                  }}>
                  {job.salary_min && job.salary_max
                    ? `${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
                    : job.salary_min ? `${fmtMan(job.salary_min)}万円〜`
                    : `〜${fmtMan(job.salary_max)}万円`}
                  </span>
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
                {isBusinessJob && (job.ote_min || job.ote_max) && (
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
                    fontSize: 12, fontWeight: 600, padding: "5px 11px",
                    background: "#fff", border: "1px solid var(--line)", borderRadius: 100,
                    color: "var(--ink)",
                  }}>
                    {b}
                  </span>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* スクロール検知スティッキーCTA — ヒーロー直下にセンチネルを置き、通過後に表示 */}
      {/*
        ⚠️ 面談の可否は accepting_casual_meetings で判定すること（2026-08-06 に統一）。
           それまで jobs_public を見ていたが、申込ページ本体（casual-meeting/page.tsx）と
           API（/api/casual-meetings）は accepting_casual_meetings しか見ていないため、
           2つがずれると「ボタンは出るが押すと受付していません」「面談できるのに
           ボタンが出ない」が起きる。実際に非掲載企業で1社ずつ起きていた。
      */}
      <JobMobileStickyBar
        casualHref={companyHref && company.accepting_casual_meetings ? `${companyHref}/casual-meeting?job_id=${job.id}` : undefined}
        applyHref={`/jobs/${job.id}/apply`}
      />

      {/* Body */}
      <div style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          {/* ⚠️ 1fr ではなく minmax(0,1fr)。
              1fr は minmax(auto,1fr) と同じで、トラックが中身の min-content 未満に
              縮まない。長い英数字や nowrap の要素が1つあるだけでトラックが広がり、
              375px の画面で本文が 414px になってはみ出す（2026-08-04 実測）。
              祖先の overflow:hidden で切れるので気づきにくい。 */}
          <div className="grid gap-7 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_320px]">

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
                  fontSize: 12, fontWeight: 800, color: "var(--royal)", letterSpacing: "0.08em",
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, background: "var(--royal)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </span>
                  この募集のポイント
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
                <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 2.0, whiteSpace: "pre-wrap" }}>{job.overview}</p>
              </section>
              )}

              {/* Skills */}
              {(job.required_skills.length > 0 || job.preferred_skills.length > 0) && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                }>
                  必須スキル / 歓迎スキル
                </SecTitle>
                {/* 必須スキル — pill tags */}
                {job.required_skills.length > 0 && (
                <div style={{ marginBottom: job.preferred_skills.length > 0 ? "var(--space-5)" : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#B45309", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    必須スキル
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {job.required_skills.map((s, i) => (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "6px 14px", borderRadius: 100,
                        background: "#FFFBEB", border: "1.5px solid #FDE68A",
                        color: "#92400E", fontSize: 13, fontWeight: 600,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                )}
                {/* 歓迎スキル — pill tags (lighter style) */}
                {job.preferred_skills.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--royal)", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    歓迎スキル
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {job.preferred_skills.map((s, i) => (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "6px 14px", borderRadius: 100,
                        background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                        color: "var(--royal)", fontSize: 13, fontWeight: 600,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                )}
              </section>
              )}

              {/* 勤務条件 */}
              {(job.salary_min || job.salary_max || job.location || job.work_style || job.employment_type) && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--royal)" icon={
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
                    <div style={{ padding: "16px 20px", borderRadius: isBusinessJob && (job.ote_min || job.ote_max) ? "12px 12px 0 0" : 12, background: "var(--royal-50)", border: "1px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
                          想定年収
                        </span>
                      </div>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>
                        {job.salary_min && job.salary_max
                          ? `${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
                          : job.salary_min ? `${fmtMan(job.salary_min)}万円〜`
                          : `〜${fmtMan(job.salary_max)}万円`}
                      </span>
                    </div>
                    {/* OTE行（営業職かつ入力あり） */}
                    {isBusinessJob && (job.ote_min || job.ote_max) && (
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
                          ? `${fmtMan(job.ote_min)}〜${fmtMan(job.ote_max)}万円`
                          : job.ote_min ? `${fmtMan(job.ote_min)}万円〜`
                          : `〜${fmtMan(job.ote_max)}万円`}
                      </span>
                    </div>
                    )}
                  </div>
                  )}
                  {/* セールス専用: 担当セグメント・新規/既存 */}
                  {isBusinessJob && ((job.sales_segment?.length ?? 0) > 0 || job.sales_hunter_farmer || job.incentive_note) && (
                  <div style={{ gridColumn: "1 / -1", padding: "16px 20px", borderRadius: 12, background: "#F8FAFC", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "var(--royal)", color: "#fff" }}>営業職</span>
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
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>勤務地</span>
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
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>働き方</span>
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
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>雇用形態</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{job.employment_type}</span>
                  </div>
                  )}
                  {/* 職種 */}
                  {job.roleLabel && (
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                      </svg>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>職種</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{job.roleLabel}</span>
                  </div>
                  )}
                </div>
              </section>
              )}

              {/* ── 企業について ── */}
              {(company.about || company.why_join) && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                }>
                  企業について
                </SecTitle>
                {company.about && (
                  <div style={{ marginBottom: company.why_join ? 24 : 0 }}>
                    {company.about.split("\n").filter((line: string) => line.trim()).map((line: string, i: number) => (
                      <p key={i} style={{ margin: i > 0 ? "14px 0 0" : 0, fontSize: 15, color: "var(--ink)", lineHeight: 1.85, fontFamily: "var(--font-noto-sans)" }}>
                        {line.trim()}
                      </p>
                    ))}
                  </div>
                )}
                {company.why_join && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" }}>
                        この会社の魅力
                      </h3>
                      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {company.why_join.split(/。(?!\s*$)/).filter((s: string) => s.trim()).map((sentence: string, i: number) => (
                        <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <span style={{
                            flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                            background: "var(--royal-50)", color: "var(--royal)",
                            border: "1.5px solid var(--royal-100)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 800, fontFamily: "Inter", marginTop: 2,
                          }}>{i + 1}</span>
                          <p style={{ margin: 0, fontSize: 15, color: "var(--ink)", lineHeight: 1.9, fontFamily: "var(--font-noto-sans)" }}>
                            {sentence.trim().replace(/。$/, "")}。
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 非公開企業ではCTAごと出さない。飛べないリンクを置かない */}
                {companyHref && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
                  <Link href={companyHref} style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {company.name}の企業詳細を見る
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                </div>
                )}
              </section>
              )}

              {/* ── 福利厚生・評価制度 ── */}
              {((company.benefits && company.benefits.length > 0) || company.evaluationSystem) && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                }>
                  福利厚生・評価制度
                </SecTitle>

                {/* 福利厚生 */}
                {company.benefits && company.benefits.length > 0 && (() => {
                  type BenefitIconDef = { svg: React.ReactNode; color: string; bg: string; border: string };
                  function getBenefitIconDef(b: string): BenefitIconDef {
                    const royal: BenefitIconDef = {
                      color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)",
                      svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
                    };
                    if (b.includes("リモート") || b.includes("在宅") || b.includes("テレワーク"))
                      return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> };
                    if (b.includes("フレックス") || b.includes("時差出勤"))
                      return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> };
                    if (b.includes("副業") || b.includes("兼業"))
                      return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> };
                    if (b.includes("ストックオプション") || b.includes("SO") || b.includes("確定拠出") || b.includes("退職金"))
                      return { color: "#065f46", bg: "#d1fae5", border: "#a7f3d0", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> };
                    if (b.includes("書籍") || b.includes("学習") || b.includes("研修") || b.includes("資格"))
                      return { color: "#5b21b6", bg: "#ede9fe", border: "#ddd6fe", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> };
                    if (b.includes("育休") || b.includes("産休") || b.includes("子育て"))
                      return { color: "#9a3412", bg: "#ffedd5", border: "#fed7aa", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> };
                    if (b.includes("健康") || b.includes("医療") || b.includes("保険"))
                      return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> };
                    if (b.includes("RSU") || b.includes("持株"))
                      return { color: "#065f46", bg: "#d1fae5", border: "#a7f3d0", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> };
                    return royal;
                  }
                  return (
                    <div style={{ marginBottom: company.evaluationSystem ? 24 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", whiteSpace: "nowrap" as const }}>福利厚生</h3>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                        {company.benefits!.map((b: string) => {
                          const def = getBenefitIconDef(b);
                          return (
                            <div key={b} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "14px 14px", background: def.bg, border: `1px solid ${def.border}`, borderRadius: 12 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", border: `1px solid ${def.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: def.color, flexShrink: 0 }}>
                                <span style={{ display: "flex", alignItems: "center", transform: "scale(1.5)" }}>{def.svg}</span>
                              </div>
                              <span style={{ fontSize: 12, color: def.color, fontWeight: 700, lineHeight: 1.4 }}>{b}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 評価制度 */}
                {company.evaluationSystem && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", whiteSpace: "nowrap" as const }}>評価制度</h3>
                      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                    </div>
                    <EvaluationText text={company.evaluationSystem} />
                  </div>
                )}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
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
                  display: "flex", flexWrap: "wrap", gap: "var(--space-3)", fontSize: 12, color: "var(--ink-mute)", fontWeight: 500,
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
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                }>
                  メイン業務
                </SecTitle>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {job.main_tasks.map((task, i) => (
                    <li key={i} style={{
                      display: "flex", gap: 14, alignItems: "flex-start",
                      padding: "12px 16px", borderRadius: 10,
                      background: "var(--bg-tint)", border: "1px solid var(--line)",
                    }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                        background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
                        color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, fontFamily: "Inter, sans-serif",
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.75, flex: 1 }}>{task}</span>
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
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                }>
                  選考フロー
                </SecTitle>
                {/* 縦並びタイムライン */}
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {job.selection_flow.map((step, i) => {
                    const isFirst = i === 0;
                    const isLast = i === job.selection_flow.length - 1;
                    return (
                      <div key={i} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                        {/* 左：番号ドット + 縦線 */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                            background: isLast
                              ? "linear-gradient(135deg, var(--success) 0%, #34D399 100%)"
                              : isFirst
                              ? "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)"
                              : "#fff",
                            border: isLast ? "none" : isFirst ? "none" : "2px solid var(--line)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: (isFirst || isLast) ? "#fff" : "var(--ink-mute)",
                            fontSize: 13, fontWeight: 800, fontFamily: "Inter, sans-serif",
                            boxShadow: isFirst || isLast ? "0 4px 12px rgba(0,35,102,0.2)" : "none",
                          }}>
                            {isLast ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8}><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (i + 1)}
                          </div>
                          {!isLast && (
                            <div style={{ width: 2, flex: 1, minHeight: 16, background: "var(--line)", margin: "4px 0" }} />
                          )}
                        </div>
                        {/* 右：内容 */}
                        <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20, paddingTop: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-mute)", marginBottom: 3 }}>
                            {step.step}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: step.meta ? 4 : 0 }}>
                            {step.name}
                          </div>
                          {step.meta && (
                            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>{step.meta}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                <SecTitle color="var(--royal)" icon={
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
                        display: "flex", alignItems: "center", gap: 6, fontSize: 12,
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
                        fontSize: 12, padding: "2px 8px", borderRadius: 100,
                        background: "var(--warm-soft)", color: "#B45309", fontWeight: 600,
                      }}>
                        {company.phase}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-4)", fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, flexWrap: "wrap" }}>
                      <span>業種 <strong style={{ color: "var(--ink)" }}>{company.industry}</strong></span>
                      <span>従業員 <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{company.employee_count?.toLocaleString() ?? "—"}</strong>名</span>
                    </div>
                  </div>
                </div>

                {/* ⑥ Fit positives — こんな人に向いている */}
                {company.fit_positives && company.fit_positives.length > 0 && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em",
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

                {/* ⑥ Prominent CTA to company page。非公開企業では出さない */}
                {companyHref && (
                <Link
                  href={companyHref}
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
                )}
              </section>

              {/* Share — bottom of main content */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <JobInlineShare jobId={job.id} jobTitle={job.role} companyName={company.name} />
              </div>

              {/* 現役社員・OB/OG — 職種マッチ */}
              <JobEmployeesSection
                current={jobEmployees.current}
                alumni={jobEmployees.alumni}
                companyId={job.company_id}
                casualHref={companyHref && company.accepting_casual_meetings ? `${companyHref}/casual-meeting` : null}
                companyName={company.name}
              />

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
                    {company.name}の他の募集
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
                          <div style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
                            {(rj.salary_min || rj.salary_max)
                              ? `${rj.salary_min && rj.salary_max ? `${fmtMan(rj.salary_min)}〜${fmtMan(rj.salary_max)}万円` : rj.salary_min ? `${fmtMan(rj.salary_min)}万円〜` : `〜${fmtMan(rj.salary_max)}万円`} · `
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
                  {/* ⚠️ companyHref が null（非公開企業）ならCTAごと出さない */}
                  {company.accepting_casual_meetings && companyHref && (
                    <Link href={`${companyHref}/casual-meeting?job_id=${job.id}`} style={{
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
                    width: "100%", padding: company.accepting_casual_meetings ? "12px var(--space-6)" : "15px var(--space-6)",
                    background: company.accepting_casual_meetings
                      ? "rgba(0,35,102,0.06)"
                      : "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
                    color: company.accepting_casual_meetings ? "var(--royal)" : "#fff",
                    border: company.accepting_casual_meetings ? "1.5px solid var(--royal-100)" : "none",
                    borderRadius: 10,
                    fontSize: company.accepting_casual_meetings ? "var(--text-sm)" : "var(--text-base)",
                    fontWeight: 700, textDecoration: "none", textAlign: "center",
                    boxShadow: company.accepting_casual_meetings ? "none" : "0 4px 16px rgba(0,35,102,0.28)",
                  }}>
                    この募集に応募する
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
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 14 }}>
                  募集サマリー
                </div>
                {/* Salary — highlighted row */}
                {(job.salary_min || job.salary_max) && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-2)", borderRadius: 8,
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)", gap: "var(--space-2)",
                }}>
                  <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, flexShrink: 0 }}>想定年収</span>
                  <span style={{
                    fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--royal)",
                    fontFamily: "Inter, sans-serif", textAlign: "right" as const,
                  }}>
                    {job.salary_min && job.salary_max
                      ? `${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
                      : job.salary_min ? `${fmtMan(job.salary_min)}万円〜`
                      : `〜${fmtMan(job.salary_max)}万円`}
                  </span>
                </div>
                )}
                {[
                  { key: "職種", value: job.roleLabel },
                  { key: "雇用形態", value: job.employment_type },
                  { key: "勤務地", value: job.location },
                  { key: "働き方", value: job.work_style },
                  { key: "経験", value: job.experience },
                ].map(({ key, value }) => (
                  <div key={key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "var(--space-2) 0", borderBottom: "1px solid var(--line-soft, #F1F5F9)", gap: "var(--space-2)",
                  }}>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, flexShrink: 0 }}>{key}</span>
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
