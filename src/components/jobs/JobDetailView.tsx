/**
 * src/components/jobs/JobDetailView.tsx
 *
 * 求人詳細の本体。**公開ページとプレビューで同じものを描く。**
 *
 * ⚠️★**`/jobs/[id]` は ISR（`revalidate = 60`）で応答がキャッシュ共有される。**
 *    実測で `x-vercel-cache: STALE` が返る。だからあのページに
 *    「閲覧者が管理者なら下書きも見せる」という分岐を足してはいけない
 *    ——**プレビューが他人に配られる。** プレビューを別ルートにしてあるのはこのため
 *    （`/biz/jobs/[id]/preview` は `force-dynamic` ＋ noindex）。
 *
 * ⚠️ ここを部品にしたのは「公開ページとプレビューが別物になる」のを防ぐため。
 *    プレビュー側にJSXをコピーしない。**差が出たらプレビューの意味が無くなる。**
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { ConditionRow } from "@/components/jobs/ConditionRow";
import { getJobBySlugOrId, getJobForPreview, getJobPositionMembers, getJobEmployees, getCompanyEmployeesCached, getCompanyToolsCached, getPublicAmbassadorsCached, getCompanyRecruitersCached, getCompanyBySlugOrId, getRoleTree, resolvePublishedCompanyHref, type JobPositionMember } from "@/lib/supabase/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const getJobBySlugOrIdCached = cache(getJobBySlugOrId);
/* ⚠️ 企業詳細ページと同じ形（`companies/[id]/page.tsx` の `getCompanyBySlugOrIdCached`）。
      `cache()` で包むのは、metadata と本体で2回呼んでも1回で済ませるため。 */
const getCompanyForJobCached = cache(getCompanyBySlugOrId);
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { JobMobileStickyBar } from "@/components/jobs/JobMobileStickyBar";
import { JobInlineShare } from "@/components/jobs/JobShareButton";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { getSalesSegmentLabel, getHunterFarmerLabel } from "@/lib/constants/salesFields";
import { isBusinessRole } from "@/lib/roles/jobRoles";
import { fmtMan } from "@/lib/utils/salary";
import { SCHEMA_EMPLOYMENT_TYPE } from "@/lib/constants/schemaEmploymentType";
import { formatEmployeeCount } from "@/lib/utils/employeeCount";
import { primaryBusinessDomain } from "@/types/genre";
import { Markdown } from "@/components/common/Markdown";
import ToolsSectionClient from "@/app/(jobseeker)/companies/[id]/ToolsSectionClient";
import { LocationsCapitalSection } from "@/components/companies/LocationsCapitalSection";
import { BenefitsList } from "@/components/companies/BenefitsList";
/* ⚠️ 2026-08-30 にページから切り出した。`/dev/preview/employees` から見るため
      （ページ内のローカル関数だと preview で import できない）。 */
import { JobEmployeesSection } from "@/components/jobs/JobEmployeesSection";
import { RecruitersSection } from "@/components/companies/RecruitersSection";
import { MEETING_CTA_BG, MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";

// 5分間ページキャッシュ（ISR）
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
  /* アイコンの色。塗り色 → 淡い背景＋濃い前景（companies/[id] と同じ形）。
     ⚠️★2026-08-29 に **purple / warm / ink / ink-mute / #0891B2 を削除した。**
        実測で**呼び出しは `var(--royal)` 9件と `var(--accent)` 1件だけ**で、
        残りは一度も使われていなかった。
        `.claude/skills/ui-conventions`「色の役割」は**紫＝使わない／
        オレンジ＝カジュアル面談だけ**と定めているので、選べる状態にしない。
     ⚠️ `--success` は残す（「金銭的にプラス」の役割が定義されている）。 */
  const iconBgMap: Record<string, string> = {
    "var(--royal)":   "var(--royal-50)",
    "var(--accent)":  "var(--royal-50)",
    "var(--success)": "var(--success-soft,#ECFDF5)",
  };
  const iconFgMap: Record<string, string> = {
    "var(--royal)":   "var(--royal)",
    "var(--accent)":  "var(--accent)",
    "var(--success)": "var(--success)",
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
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)", marginTop: 2 }}>
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

// ── 求人詳細: 現役社員・OB/OG セクション ────────────────────────────────────

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
          {/* ⚠️ 18px。SecTitle と同じ大きさに揃える（2026-08-30。--text-lg は 20px）。 */}
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
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
                    background: "var(--success-soft)", color: "var(--success-ink)", border: "1px solid #A7F3D0",
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

export async function JobDetailView({
  id,
  preview = false,
}: {
  /** slug または UUID。`preview` のときは UUID のみ */
  id: string;
  /** ⚠️ **`/biz/jobs/[id]/preview` だけが true にする。**
   *  下書き・非公開・テスト求人も描画し、slug への 308 リダイレクトを止める。 */
  preview?: boolean;
}) {
  const result = preview
    ? await getJobForPreview(id)
    : await getJobBySlugOrIdCached(id);
  if (!result) notFound();

  const { job, company, relatedJobs, resolvedId, slug: jobSlug } = result;

  // ⚠️ 企業ページへのリンクは env に関係なく is_published を見る。
  //    「求人は公開企業にしか紐づかない」は今そうなっているだけで、
  //    企業を非公開に戻せば崩れる（CLAUDE.md の原則）。null ならテキスト表示にする。
  const companyHref = await resolvePublishedCompanyHref(company.slug ?? company.id);

  // UUID → slug 308 redirect
  /* ⚠️ プレビューでは slug へ飛ばさない。下書きは slug を持たないし、
        飛ばすと公開ページ（404）に着く。 */
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!preview && isUUID && jobSlug) { permanentRedirect(`/jobs/${jobSlug}`); }

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

  /* ★企業側の情報を求人詳細にも出す（2026-08-30）。企業詳細と同じ関数を使う。
     ⚠️ **人物は「職種一致した人を会社セクションから除く」。** そうしないと
        同じ人が「この職種の現役メンバー」と「この会社の現役社員」に2回出る。
        2026-08-30 に「企業について」の重複を消したばかりで、同じ形を作らない。
     ⚠️ `getJobEmployees` は `getCompanyEmployees` を職種で絞ったものなので、
        **同じ元から引いて差集合を取る**（別々に引くと基準がずれる）。
     ⚠️ どちらも `unstable_cache` 付き。ここで生のクライアントを使わない。 */
  const [allEmployees, companyTools, companyResult, ambassadors, recruiters] = await Promise.all([
    getCompanyEmployeesCached(job.company_id),
    getCompanyToolsCached(job.company_id),
    /* ⚠️ `detail`（拠点・資本関係）はここからしか取れない。
          企業詳細ページと同じ `getCompanyBySlugOrIdCached` を使う。 */
    getCompanyForJobCached(job.company_id),
    /* ★「話を聞ける人」の一覧（2026-08-30）。企業詳細と同じ関数。
          ⚠️ これが無いと**誰を指名できるか判断できない**。判断できないまま
             セクション末尾に一括CTAを置いていたのが、今回直す誤解の原因。 */
    getPublicAmbassadorsCached(job.company_id),
    /* ★採用担当者（2026-09-03）。企業詳細と同じ関数・同じキャッシュ。
          ⚠️ `unstable_cache` 付きのほうを呼ぶ。生の `getCompanyRecruiters` を使わない。 */
    getCompanyRecruitersCached(job.company_id),
  ]);
  const companyDetail = companyResult?.detail ?? null;
  const matchedIds = new Set<string>(
    [...jobEmployees.current, ...jobEmployees.alumni].map((e) => e.userId),
  );
  /* ⚠️ 面談可かどうかは `ow_company_members`（本人の同意 + 掲載）で決まる。
        `CompanyEmployee` 型には入っていないので、ここで突き合わせる。 */
  const talkableIds = new Set<string>((ambassadors ?? []).map((a) => a.user_id));

  /* ⚠️★`alumni` は組み立てない（2026-08-30 に取りやめ / 柴さん）。
        会社全体のOB・OGを求人ページに出すと、求人の職種と無関係な人が
        「OB・OG」として並び、「この求人を経験した人」と区別が付かなかった。
        OB・OG は `jobEmployees.alumni`（職種一致）だけが出す。
     ⚠️ ここに alumni を足し戻さないこと。足すと同じ状態に戻る。 */
  const otherEmployees = {
    current: (allEmployees?.current ?? []).filter((e) => !matchedIds.has(e.userId)),
  };

  /* ⚠️ ブックマーク状態はここで引かない（2026-08-09）。
        引くと `auth.getUser()` が要り、ルートが動的化して
        `export const revalidate = 60` が効かなくなる。
        BookmarkButton が props 無しのとき自分で取りに行く。
        ⚠️ ここに閲覧者依存の問い合わせを足さないこと。

     ⚠️ 以降の問い合わせは admin クライアントを使う。
        session クライアント（`createClient()`）は Cookie を読むため、
        1箇所でも使うとルートごと動的になる。 */
  const supabase = createAdminClient();

  // 同じ職種の他社求人。
  // 旧実装は job_category の完全一致だったため、「エンタープライズ営業」と「営業」が
  // 別物になり関連求人がほぼ出なかった。ow_job_roles で同じ職種を持つ求人を引く。
  const sameCategoryJobs: RelatedJob[] = [];
  const ownRoleIds = job.roleIds ?? [];
  if (ownRoleIds.length > 0) {
    /* ⚠️ ここから下、Supabase の呼び出しは `error` を必ず受けてログに出す（2026-08-29）。
          捨てると **RLS も GRANT も 400 も、すべて「0件」に化ける**。`?? []` で受けている
          側からは区別が付かず、画面には**節ごと消えたようにしか見えない**。
          ⚠️ `try/catch` では捕まらない。supabase-js はエラーを**戻り値**で返す。 */
    const { data: siblingRoleRows, error: siblingRoleRowsErr } = await supabase
      .from("ow_job_roles")
      .select("job_id")
      .in("role_id", ownRoleIds)
      .neq("job_id", jobId);
    if (siblingRoleRowsErr) console.error("[jobs/[id]] ow_job_roles:", siblingRoleRowsErr.message);
    const siblingIds = Array.from(new Set((siblingRoleRows ?? []).map((r) => r.job_id as string)));

    const { data: sameCatRaw } = siblingIds.length > 0
      ? await supabase
          .from("ow_jobs")
          .select("id, slug, title, job_category, salary_min, salary_max, company_id, updated_at, ow_companies!inner(id, name, logo_url, logo_letter, logo_gradient)")
          .eq("status", "published").eq("is_test", false)
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
          /* ⚠️ 不明を FULL_TIME に倒さない（2026-08-07）。
             schema.org の employmentType は決まった英語の語彙で、
             日本語の「正社員」を入れても解釈されない。
             写せない値・未設定のときは**項目ごと出さない**。 */
          ...(SCHEMA_EMPLOYMENT_TYPE[job.employment_type ?? ""]
            ? { employmentType: SCHEMA_EMPLOYMENT_TYPE[job.employment_type ?? ""] }
            : {}),
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
                {/* ⚠️ **区切りを先に書かない。** 2026-08-25 まで
                       `{company.industry}{... ? ` · ${...}` : ""}` と書いており、
                       業種が空の企業では **先頭に「 · 」だけが残っていた**
                       （`mapCompany` が `?? ""` で潰すので null にならず、条件分岐が効かない）。
                       ある項目だけを集めて join する。 */}
                {[
                  primaryBusinessDomain(company.business_domains)?.name,
                  formatEmployeeCount(company.employee_count),
                ].filter(Boolean).length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
                    {[
                      primaryBusinessDomain(company.business_domains)?.name,
                      formatEmployeeCount(company.employee_count),
                    ].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>

              {/* HOT badge */}
              {job.urgency === "hot" && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 6, marginBottom: "var(--space-2)",
                  background: "#FEE2E2", color: "var(--error-ink)",
                  fontSize: 12, fontWeight: 800, letterSpacing: "0.08em",
                  fontFamily: "var(--font-inter), var(--font-noto)", border: "1px solid #FECACA",
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
                    color: "var(--success-ink)", fontSize: 15, fontWeight: 700,
                    fontFamily: "var(--font-inter), var(--font-noto)",
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
                    fontFamily: "var(--font-inter), var(--font-noto)",
                  }}>
                    OTE&nbsp;{job.ote_min && job.ote_max
                      ? `${fmtMan(job.ote_min)}〜${fmtMan(job.ote_max)}万円`
                      : job.ote_min ? `${fmtMan(job.ote_min)}万円〜`
                      : `〜${fmtMan(job.ote_max)}万円`}
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
        applyHref={company.application_open ? `/jobs/${job.id}/apply` : undefined}
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
                {/* ⚠️ markdown として描画する（2026-08-26）。入力欄が markdown なので合わせる。
                       ⚠️ 本番5件は改行を含まないので、この変更で見た目は変わらない。 */}
                <Markdown>{job.overview}</Markdown>
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
                  {/* ⚠★オレンジにしない（2026-08-29）。**オレンジはカジュアル面談だけの色**
                         （.claude/skills/ui-conventions「色の役割」）。必須スキルの見出しに使うと、
                         同じページのカジュアル面談 CTA と同じ色が別の意味を持つ。
                      ⚠ 強調は**太さ**で足りる。
                      ⚠ 2026-08-30: 中立色にしていたが、**すぐ下の歓迎スキルが royal** なので
                         必須だけ色が違うと弱く見えた。**必須と歓迎は同じ royal** にし、
                         区別は見出しの文言に任せる。 */}
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--royal)", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    必須スキル
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {job.required_skills.map((s, i) => (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "6px 14px", borderRadius: 100,
                        /* ⚠️ 黄色にしない（2026-08-30）。ui-conventions「色の役割」で
                              **黄色背景は使わない**。すぐ下の歓迎スキルは royal なので、
                              必須だけ色が違うと「必須＝警告」に読める。
                           ⚠️ 必須と歓迎の区別は**見出しの文言**が担う。色で差をつけない
                              （このすぐ上のコメント「強調は太さで足りる」と同じ考え方）。 */
                        background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                        color: "var(--royal)", fontSize: 13, fontWeight: 600,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
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
                  {/* 基本給行。
                      ⚠️★**`space-between` にしないこと**（2026-09-02）。
                         元は「ラベル ← → 金額」の2つで両端に寄せていたが、
                         ① 補足を3つ目の子として足したら金額が中央に浮いて間延びし、
                         ② 2つに戻しても **1440px でラベルと金額の間が 345px** 空いた。
                         どちらも「横に長くて読みにくい」。
                      ⚠️ **下のカード群（勤務地・働き方…）と同じ「ラベルが上・値が下」に揃えてある。**
                         同じブロックの中で並びの規則を2つ持たない。 */}
                  <div style={{
                    padding: "16px 20px",
                    borderRadius: isBusinessJob && (job.ote_min || job.ote_max) ? "12px 12px 0 0" : 12,
                    background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
                        想定年収
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--royal)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                        {job.salary_min && job.salary_max
                          ? `${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
                          : job.salary_min ? `${fmtMan(job.salary_min)}万円〜`
                          : `〜${fmtMan(job.salary_max)}万円`}
                      </span>
                    </div>
                    {/* 給与の補足（「※年棒制」「業績連動ボーナスあり」など）。
                        ⚠️ 入力欄は前からあったのに `JOB_DETAIL_COLS` に無く、
                           公開2件とも埋まっているのに一度も出ていなかった（2026-09-02 に追加）。 */}
                    {job.salary_note && (
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                        {job.salary_note}
                      </p>
                    )}
                  </div>
                    {/* OTE行（営業職かつ入力あり）。
                        ⚠️ 上の基本給行と同じ「ラベルが上・値が下」。両端寄せに戻さないこと。
                        ⚠️★**条件式の直後（`&& (` の次の行）にコメントを置かないこと。**
                           子が2つになり `tsc` が「')' expected」で落ちる。ガードの外に書く。
                        ⚠️ コメント本文に閉じ記号（アスタリスク＋スラッシュ）を書くと
                           そこでコメントが終わってしまう。記号で例示しないこと。 */}
                    {isBusinessJob && (job.ote_min || job.ote_max) && (
                    <div style={{ padding: "14px 20px", borderRadius: "0 0 12px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderTop: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 7, background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                          </svg>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8" }}>OTE（目標達成時）</span>
                      </div>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "#1D4ED8", fontFamily: "var(--font-inter), var(--font-noto)" }}>
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
                  {/* ⚠️ 同じ形のカードが増えたので `ConditionRow` に寄せた（2026-09-02）。
                         それまで**同一のマークアップが4回コピー**されており、
                         行を足すたびに 12行の複製が増える形だった。
                      ⚠️ **値が無い行は出さない**（`ConditionRow` が null を返す）。
                         「—」で埋めない。CLAUDE.md「値が無いことを、ある値に置き換えない」。 */}
                  <ConditionRow label="勤務地" value={job.location} icon={
                    <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>
                  } />
                  <ConditionRow label="働き方" value={job.work_style} icon={
                    <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>
                  } />
                  <ConditionRow label="雇用形態" value={job.employment_type} icon={
                    <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>
                  } />
                  <ConditionRow label="職種" value={job.roleLabel} icon={
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  } />
                  {/* ★勤務体系・休日・試用期間（2026-09-02 追加）。
                         HERP など他社の求人票が「待遇・労働環境」として出している項目で、
                         **列は前からあったのに入力欄も描画も無く、全件0件だった。** */}
                  <ConditionRow label="勤務体系" value={job.work_hours} icon={
                    <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>
                  } />
                  <ConditionRow label="休日・休暇" value={job.holidays} icon={
                    <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>
                  } />
                  <ConditionRow label="試用期間" value={job.probation_period} icon={
                    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>
                  } />
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
                      <p key={i} style={{ margin: i > 0 ? "14px 0 0" : 0, fontSize: 15, color: "var(--ink)", lineHeight: 1.85, fontFamily: "var(--font-inter), var(--font-noto)" }}>
                        {line.trim()}
                      </p>
                    ))}
                  </div>
                )}
                {company.why_join && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" }}>
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
                            fontSize: 12, fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)", marginTop: 2,
                          }}>{i + 1}</span>
                          <p style={{ margin: 0, fontSize: 15, color: "var(--ink)", lineHeight: 1.9, fontFamily: "var(--font-inter), var(--font-noto)" }}>
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

              {/* ── 福利厚生 ──
                     ⚠️★**評価制度は 2026-08-30 に削除した（柴さん）。戻さないこと。**
                        `/biz/company` の入力欄は **2026-07-28 に既に撤去済み**で
                        （CLAUDE.md「biz/company フォームから削除した項目」）、
                        **入力できないのに表示だけ残っていた。** 本番でも 89社中2社。
                     ⚠️ `ow_companies.evaluation_system` 列と `mapCompany` の
                        `evaluationSystem` は**残してある**（撤去済み5項目と同じ扱い）。
                        **新しい表示先を作らないこと。** 作るなら入力欄とセットで。
                     ⚠️ 内側の `<h3>福利厚生</h3>` と罫線も落とした。評価制度が無くなり
                        `SecTitle` と**同じ文字が2つ並ぶ**ため（企業詳細も SecTitle だけ）。 */}
              {company.benefits && company.benefits.length > 0 && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                }>
                  福利厚生
                </SecTitle>

                {/* ⚠️★中身は共通部品（2026-08-30）。**企業詳細とまったく同じ**
                       データ（`ow_companies.benefits`）・同じ見せ方（カテゴリ分け + すべて見る）。
                    ⚠️ 以前はここに**独自のアイコン判定**があり、企業詳細と食い違っていた
                       （`介護` `育児` `食事` `ランチ` `社食` `株式` `勉強会` `セミナー` `資格` を
                        拾えず、緑の色も直書きしていた）。**書き戻さないこと。** */}
                <BenefitsList benefits={company.benefits} />
              </section>
              )}


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
                        fontSize: 12, fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)",
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
                <div style={{ padding: "var(--space-4) var(--space-6) var(--space-3)", background: "var(--royal-50)", borderBottom: "1px solid var(--royal-100)", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--royal)" }}>チーム構成</span>
                </div>
                <div style={{ padding: "var(--space-4) var(--space-6)", fontSize: "var(--text-base)", color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                  {job.team_composition}
                </div>
              </div>
              )}

              {/* なぜ今採用するか */}
              {job.why_hire && (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", marginBottom: 0, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
                <div style={{ padding: "var(--space-4) var(--space-6) var(--space-3)", background: "var(--royal-50)", borderBottom: "1px solid var(--royal-100)", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  {/* ⚠ 同上。オレンジはカジュアル面談だけ。ここは royal（主要な情報）にする */}
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--royal)" }}>なぜ今採用するか</span>
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
                            fontSize: 13, fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)",
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
                        {/* 右：内容。
                            ⚠️★**`step.step` を出さないこと**（2026-09-02 に削除）。
                               `mapJob` が `String(i + 1)` を入れているだけで、
                               **左のドットとまったく同じ数字が2つ並んでいた。**
                               番号はドットが持つ。ここは名前だけにする。 */}
                        <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20, paddingTop: 10 }}>
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
                        <span style={{ padding: "2px 7px", borderRadius: 4, background: "var(--success-soft)", color: "var(--success-ink)" }}>
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

              {/* ⚠️★「企業について」の2つ目（Company summary）は削除した（2026-08-30）。
                     **同じ見出しがページ内に2つあり、下の方は中身がほぼ重複していた。**

                     実測（本番 / 全文と出現回数を数えた）:
                       事業領域 2回 ／ 従業員 3,500名以上 2回 ／ 上場 2回 ／ CRM・営業支援 3回
                       企業ページへのリンク **3回**（ヘッダー・上の「企業について」末尾・ここ。
                                                 すべて同じ `/companies/[slug]`）
                     つまり**ここにしか無いのは `company.mission` の1行だけ**だった。

                  ⚠️ ミッションは英語1行で、上の「企業について」には既に日本語の説明と
                     「この会社の魅力」3点がある。**企業ページには残る**ので情報は失われない
                     （柴さんの判断・2026-08-30）。

                  ⚠️★**同じ見出しを2つ置かないこと。** 企業の情報を足したくなったら、
                     上の「企業について」（同名の JSX コメントがある箇所）に足す。 */}

              {/* Share — bottom of main content */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <JobInlineShare jobId={job.id} jobTitle={job.role} companyName={company.name} />
              </div>

              {/* 現役社員・OB/OG — 職種マッチ
                     ⚠️★OB・OG は**0件でも枠ごと出す**（`alwaysShowAlumni`）。
                        「この求人の職種を経験して退職した人」という項目そのものを
                        見せたい、という判断（柴さん・2026-08-30）。 */}
              <JobEmployeesSection
                current={jobEmployees.current}
                alumni={jobEmployees.alumni}
                companyId={job.company_id}
                casualHref={companyHref && company.accepting_casual_meetings ? `${companyHref}/casual-meeting` : null}
                talkableIds={talkableIds}
                alwaysShowAlumni
              />

              {/* ★この会社の他の現役社員（職種一致を除く）── 2026-08-30 追加
                     ⚠️★**上の `JobEmployeesSection` と同じ人を出さない。**
                        `otherEmployees` は職種一致した人を差し引いた残り。
                        差し引かないと、生藤さんのように「この職種の現役メンバー」と
                        ここの両方に出る（2026-08-30 に「企業について」で消した重複と同じ形）。
                     ⚠️ 見出しで関係を明示する。「現役社員」だけだと、上の職種一致セクションと
                        何が違うのか読み手に伝わらない。

                     ⚠️★**会社全体の OB・OG は出さない**（2026-08-30 に取りやめ / 柴さん）。
                        求人の職種と無関係な人が「OB・OG」として並び、読み手には
                        「この求人を経験した人」と区別が付かなかった。
                        実例: Salesforce の求人（エンタープライズセールス）に、
                        **インサイドセールス / アカウントエグゼクティブ**の退職者が出ていた。
                        OB・OG は上の職種一致セクションだけが出す。**ここに戻さないこと。**
                     ⚠️ 現役社員のほうは残す。「この会社には他にどんな人がいるか」は
                        職種と無関係でも読み手の役に立つ。**OB・OG とは意味が違う。** */}
              <JobEmployeesSection
                current={otherEmployees.current}
                alumni={[]}
                companyId={job.company_id}
                casualHref={companyHref && company.accepting_casual_meetings ? `${companyHref}/casual-meeting` : null}
                talkableIds={talkableIds}
                currentTitle={`${company.name} の他の現役社員`}
                currentSubtitle="この求人の職種とは違う人たちです"
              />

              {/* ★ツール（企業詳細と同じ内容）── 2026-08-30 追加 */}
              {companyTools.length > 0 && (
                <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
                  <SecTitle color="var(--royal)" icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                  }>
                    ツール
                  </SecTitle>
                  {/* ⚠️ 企業詳細と同じ `ToolsSectionClient` を使う。大グループへの束ね方や
                         「すべて見る」の挙動を2つ持たない（ui-conventions「ツール表示」）。 */}
                  <ToolsSectionClient tools={companyTools} />
                </section>
              )}

              {/* ★拠点・資本関係（企業詳細と同じコンポーネント）── 2026-08-30 追加
                     ⚠️ 実体は `components/companies/LocationsCapitalSection.tsx`。
                        企業詳細から切り出して共通化した。**ここに複製しないこと。** */}
              {companyDetail && (
                <LocationsCapitalSection
                  detail={companyDetail}
                  title={
                    <SecTitle color="var(--royal)" icon={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    }>
                      拠点・資本関係
                    </SecTitle>
                  }
                />
              )}

              {/* ★採用担当者（企業詳細と同じコンポーネント）── 2026-09-03 追加
                     ⚠️ 実体は `components/companies/RecruitersSection.tsx`。
                        企業詳細から切り出して共通化した。**ここに複製しないこと。**
                     ⚠️ 位置は「拠点・資本関係」の下（柴さんの指定）。 */}
              <RecruitersSection
                recruiters={recruiters}
                title={
                  <SecTitle color="var(--royal)" icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    </svg>
                  }>
                    採用担当者
                  </SecTitle>
                }
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
                          {/* ⚠️ 12.5px のまま残す（2026-08-30 に実測）。13px に上げると
                                 求人名が **1行 → 2行**に折り返してカードが 18px → 36px に伸びる。
                                 ⚠️ このページで唯一の端数だが、**揃えるために折り返させない。**
                                 ⚠️ 12.5px はこのリポジトリで広く使われている中間値
                                    （`/search`・`/companies` ほか）で、ここだけの値ではない。 */}
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
                      background: MEETING_CTA_BG,
                      color: "#fff", borderRadius: 10,
                      fontSize: "var(--text-base)", fontWeight: 700, textDecoration: "none", textAlign: "center",
                      boxShadow: `0 4px 16px rgba(${MEETING_CTA_SHADOW_RGB},0.38)`,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span>話を聞く<span style={{ whiteSpace: "nowrap" }}>（カジュアル面談）</span></span>
                    </Link>
                  )}

                  {/* ③ Secondary: 応募する
                      ⚠️ 宛先がある企業だけ。published でも応募が届く先があるとは限らない
                         （lib/jobs/application.ts）。 */}
                  {company.application_open && (
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
                  )}

                  <BookmarkButton
                    targetType="job"
                    targetId={job.id}
                    label="保存する"
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
                    fontFamily: "var(--font-inter), var(--font-noto)", textAlign: "right" as const,
                  }}>
                    {job.salary_min && job.salary_max
                      ? `${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
                      : job.salary_min ? `${fmtMan(job.salary_min)}万円〜`
                      : `〜${fmtMan(job.salary_max)}万円`}
                  </span>
                </div>
                )}
                {/* ⚠️ 値が無い行は出さない（2026-08-07）。
                    空の値セルを並べるより、項目ごと消すほうが原則に合う。 */}
                {[
                  { key: "職種", value: job.roleLabel },
                  { key: "雇用形態", value: job.employment_type },
                  { key: "勤務地", value: job.location },
                  { key: "働き方", value: job.work_style },
                  { key: "経験", value: job.experience },
                ].filter(({ value }) => !!value).map(({ key, value }) => (
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
