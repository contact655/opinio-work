import { can, canOpenBizPath } from "@/lib/auth/roles";
import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { HomeActionList } from "@/components/business/home/HomeActionList";
import { HomeChecklist } from "@/components/business/home/HomeChecklist";
import { HomeSideColumn } from "@/components/business/home/HomeSideColumn";
import { getTenantContext, getJobStatusCounts } from "@/lib/business/dashboard";
import { getBizActionItems } from "@/lib/business/actionItems";
import { buildHomeChecklist } from "@/lib/business/homeChecklist";
import type { HomeSide } from "@/lib/business/homeTypes";
import { fetchJobsForCompany } from "@/lib/business/jobs";
import { getApproachQuota } from "@/lib/approaches/server";
import { canUse } from "@/lib/constants/plans";
import { approachQuotaTexts } from "@/lib/constants/companyApproaches";
import { isCompanyReviewed } from "@/lib/business/scoutGate";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPublishable } from "@/lib/companies/publishable";
import { companyPageStatus, companyStatusText } from "@/lib/companies/pageStatus";
import { getEvidenceMaterials } from "@/lib/evidence/materials";
import { getCompanyEmployees } from "@/lib/supabase/queries";
import { jobState } from "@/lib/jobs/jobState";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "ホーム | OPINIO Business" },
};

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName} hasCompany={false}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid var(--line)",
        padding: 40,
        textAlign: "center",
        maxWidth: "var(--max-w-form)", margin: "60px auto",
      }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          企業アカウントを追加しますか？
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 22 }}>
          このアカウントには企業が紐付いていません。<br />
          新しく企業を登録するか、招待リンクから参加してください。
        </p>
        <Link
          href="/biz/companies/add/new"
          style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            background: "var(--royal)", color: "#fff", textDecoration: "none",
          }}
        >
          企業を新規登録する →
        </Link>
      </div>
    </BusinessLayout>
  );
}

/**
 * ★企業ホーム（2026-10-12 / 柴さんの指示で作り直した）。
 *   左（主）… 対応が必要なもの（`lib/business/actionItems.ts`）→ はじめにやること（`lib/business/homeChecklist.ts`）
 *   右（細い列）… 今月のメッセージ／求人の数／企業ページの状態
 * ⚠️ 上部の数字タイル・会社名とロゴのカード・チーム・企業ページの充実度（企業入力 /45・取材 /50）・
 *    「候補者に貴社を見つけてもらうには」（貴社に移ってきた方・入社の決め手の回答）は 2026-10-12 に外した。
 * ⚠️ 左右の列は高さをそろえない（上揃え）。状態はバッジにしない。
 */
export default async function BizDashboardPage({
  searchParams,
}: {
  searchParams: { welcome?: string; denied?: string };
}) {
  const isFirstMember = searchParams?.welcome === "1";
  const ctx = await getTenantContext();

  if (!ctx) {
    return <NoTenantPage />;
  }

  const supabase = createClient();
  const quotaAllowed = canUse(ctx.planType, "companyApproach");
  const [jobStatusCounts, jobs, companyRow, publishCheck, materials, employees, quota] = await Promise.all([
    getJobStatusCounts(ctx.tenantId),
    /* ★下書きの「公開まであと〇つ」（publishMissingCount）。求人管理と同じ関数 */
    fetchJobsForCompany(supabase, ctx.tenantId, { meetings: {}, applications: {} }).catch((e) => { console.error("[dashboard] jobs:", e); return null; }),
    createAdminClient().from("ow_companies").select("listing_requested_at, accepting_casual_meetings, source").eq("id", ctx.tenantId).maybeSingle(),
    /* ★企業ページの「公開まであと〇つ」。/biz/company・掲載の依頼と同じ判定（下書きを重ね、掲載に要る項目まで見る）。
          ⚠️ `{ kind: "admin" }` ＝規約同意は数えない（同意は項目ではなく、押す人の状態） */
    checkPublishable(ctx.tenantId, { kind: "admin" }, { useDraft: true, forListing: true }),
    getEvidenceMaterials(ctx.tenantId),
    getCompanyEmployees(ctx.tenantId).catch((e) => { console.error("[dashboard] employees:", e); return null; }),
    quotaAllowed ? getApproachQuota(ctx.tenantId) : Promise.resolve(null),
  ]);
  if (companyRow.error) console.error("[dashboard] company:", companyRow.error.message);

  /* ★担当者が企業ページを一度でも保存したか（「OPINIO が作った企業ページの内容を確認する」の済み。2026-10-17） */
  const pageBuiltByOpinio = !companyRow.error && (companyRow.data?.source as string | null | undefined) !== "biz_self";
  let pageEditedByStaff: boolean | null = null;
  if (pageBuiltByOpinio) {
    const { count, error } = await createAdminClient().from("ow_activities")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.tenantId).eq("type", "company_info_updated");
    if (error) console.error("[dashboard] activities:", error.message);
    else pageEditedByStaff = (count ?? 0) > 0;
  }

  const actions = await getBizActionItems({
    companyId: ctx.tenantId, owUserId: ctx.currentOwnId, permission: ctx.currentPermission,
    planType: ctx.planType, reviewed: isCompanyReviewed(ctx), stoppedByOps: jobStatusCounts.stoppedByOps,
  });

  const listed = ctx.isPublished && ctx.listingStatus === "listed";
  const listingRequestedAt = (companyRow.data?.listing_requested_at as string | null | undefined) ?? null;
  /* ⚠️ 取れなかったとき（ok:false なのに requirements が無い）は null（「あと〇つ」を出さない） */
  const companyMissing = publishCheck.ok ? 0 : publishCheck.requirements ? publishCheck.requirements.length : null;
  /* 掲載中は企業名・業種・事業領域だけで止める（/biz/company と同じ） */
  const blockingCount = publishCheck.ok ? 0
    : (listed ? (publishCheck.requirements ?? []).filter((r) => r.scope === "always") : (publishCheck.requirements ?? [])).length;

  const drafts = (jobs ?? []).filter((j) => jobState({ status: j.status, stoppedAt: j.stoppedAt ?? null }) === "draft");
  const nearest = drafts.slice().sort((a, b) => (a.publishMissingCount ?? 99) - (b.publishMissingCount ?? 99))[0] ?? null;

  const checklist = buildHomeChecklist({
    listed,
    listingRequested: listingRequestedAt !== null,
    companyMissing,
    totalJobs: jobs ? jobs.length : null,
    publishedJobs: jobs ? jobStatusCounts.published : null,
    nearestDraft: nearest ? { id: nearest.id, title: nearest.title || "無題の求人", missing: nearest.publishMissingCount ?? 0 } : null,
    roles: materials?.roles ?? null,
    employees: employees ? employees.current.length + employees.alumni.length : null,
    acceptingCasualMeetings: companyRow.error ? null : companyRow.data?.accepting_casual_meetings === true,
    pageBuiltByOpinio,
    pageEditedByStaff,
  });

  const now = new Date();
  const side: HomeSide = {
    show: { jobs: can(ctx.currentPermission, "jobs.view"), company: can(ctx.currentPermission, "company.page") },
    quota: !quotaAllowed || !can(ctx.currentPermission, "messages.use") ? undefined : quota ? {
      sentText: `${quota.monthlyUsed}/${quota.monthlyLimit}`,
      sentSub: approachQuotaTexts(quota, now).remainingSub,
      sentPct: Math.round((quota.monthlyUsed / Math.max(1, quota.monthlyLimit)) * 100),
      openText: `${quota.openCount}/${quota.openLimit}`,
      openSub: approachQuotaTexts(quota, now).openSub,
      openPct: Math.round((quota.openCount / Math.max(1, quota.openLimit)) * 100),
    } : null,
    jobs: { published: jobStatusCounts.published, draft: jobStatusCounts.draft, stopped: jobStatusCounts.stopped },
    /* ★/biz/company の上部と同じ1行（`companyStatusText`）。⚠️ ホームでは「未公開の変更あり」を見ない */
    companyStatus: companyStatusText(
      companyPageStatus({ isPublished: ctx.isPublished, listingStatus: ctx.listingStatus, termsAgreed: true, listingRequestedAt }),
      { hasChanges: false, listingRequestedAt, blockingCount },
    ),
  };

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      {/* ★権限の無い画面から戻されたとき（2026-10-12。lib/auth/companyAccess.ts の guardBizPage） */}
      {searchParams.denied === "1" && (
        <p role="status" data-state="page-denied" style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-mute)" }}>
          その画面を開く権限がありません。役割は管理者が「メンバーと権限」で変更できます。
        </p>
      )}
      {/* ── 1人目バナー（企業開設直後のみ） ── */}
      {isFirstMember && (
        <div style={{
          background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
          borderRadius: 14,
          padding: "22px 24px",
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 5 }}>
              {ctx.tenantName} の企業アカウントを開設しました
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
              あなたはこの企業の最初の人事担当者です。まず企業情報を充実させると、候補者への信頼感が高まります。
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" as const }}>
{can(ctx.currentPermission, "company.page") && (
              <Link href="/biz/company" style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "8px 16px", borderRadius: 8,
                background: "#fff", color: "#001233",
                fontSize: 12, fontWeight: 700, textDecoration: "none",
              }}>
                企業情報を入力する →
              </Link>)}
{can(ctx.currentPermission, "members.manage") && (
              <Link href="/biz/members" style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "8px 16px", borderRadius: 8,
                background: "rgba(255,255,255,0.12)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                fontSize: 12, fontWeight: 600, textDecoration: "none",
              }}>
                メンバーを招待する
              </Link>)}
            </div>
          </div>
        </div>
      )}

      {/* ── 審査中バナー（未承認企業のみ） ── */}
      {!ctx.isApproved && (
        <div style={{
          background: "var(--warm-soft)", border: "1px solid #FCD34D",
          borderRadius: 12, padding: "14px 18px", marginBottom: 16,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warm-ink)", marginBottom: 3 }}>
              運営審査中です
            </div>
            <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.7 }}>
              承認後、候補者検索・求人公開をご利用いただけます。審査が完了次第メールでご連絡します。
            </div>
          </div>
        </div>
      )}

      <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>ホーム</h1>

      <div className="biz-home-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <HomeActionList actions={actions} />
          {/* ★役割で開けない画面へのリンクは出さない（2026-10-12） */}
          <HomeChecklist items={checklist.filter((it) => canOpenBizPath(ctx.currentPermission, it.href))} />
        </div>
        <HomeSideColumn side={side} />
      </div>
      <style>{`
        .biz-home-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (min-width: 1024px) { .biz-home-grid { grid-template-columns: minmax(0, 1fr) 280px; } }
      `}</style>
    </BusinessLayout>
  );
}
