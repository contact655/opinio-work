import { JobsClient } from "./JobsClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchJobsForCompany } from "@/lib/business/jobs";
import { countByJob, fetchCompanyReactions } from "@/lib/business/reactionCounts";
import { isJobTab, type JobStateTab } from "@/lib/jobs/jobState";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "求人管理 | OPINIO Business" },
};

/**
 * ⚠️★`?status=` を読んで初期タブに反映する（2026-08-31 に追加）。
 *
 * それまで `JobsClient` は `useState("all")` 固定で、**クエリを一切見ていなかった。**
 * ダッシュボードの求人ステータスカードは `/biz/jobs?status=...` を指しているので、
 * **どのカードを押しても「すべて」タブに着地していた。**
 * CLAUDE.md「リンク先が実在するか、そこに本当に着地するかを確かめること」。
 *
 * ⚠️ 値は `JOB_TABS`（lib/jobs/jobState.ts）と突き合わせる。知らない値は `all` に落とす。
 *   旧い値（private / pending_review / rejected。2026-10-12 まで）は「停止中」に寄せる（メールや履歴のリンクのため）
 * ★`?dept=` は部門の絞り込み（部門 id）。⚠️ 選択肢に無い値は JobsClient が無視する
 *   （URL の値をそのまま state に入れない）。
 * ⚠️ `useSearchParams()` をクライアント側で使う形にはしない。あれは静的生成時に
 *   最寄りの Suspense fallback で打ち切られる（`/jobs` で実際に踏んだ）。
 *   このページは `force-dynamic` だが、サーバーから props で渡すほうが素直。
 */
export default async function BizJobsPage({
  searchParams,
}: { searchParams?: { status?: string; dept?: string } }) {
  const raw = searchParams?.status;
  const initialStatus: JobStateTab | "all" = isJobTab(raw) ? raw
    : raw === "private" || raw === "pending_review" || raw === "rejected" ? "stopped"
    : "all";
  const initialDept = typeof searchParams?.dept === "string" ? searchParams.dept : "";
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  /* ★面談申込・応募の数は分析（/biz/analytics）と同じ関数で数える（検証用アカウントを除く）。2026-10-09 */
  /* ★閲覧数（直近30日。2026-10-12）。/biz/analytics と同じ表（ow_page_view_daily）。⚠️ 取れなければ null（0 と出さない） */
  const since = new Date(Date.now() + 9 * 3600_000 - 29 * 86_400_000).toISOString().slice(0, 10);
  const { data: viewRows, error: viewErr } = await createAdminClient()
    .from("ow_page_view_daily").select("target_id, views")
    .eq("company_id", ctx.tenantId).eq("page_type", "job").gte("view_date", since);
  if (viewErr) console.error("[biz/jobs] views:", viewErr.message);
  const views30d: Record<string, number> | null = viewErr ? null : {};
  if (views30d) for (const r of viewRows ?? []) views30d[r.target_id as string] = (views30d[r.target_id as string] ?? 0) + ((r.views as number) ?? 0);
  const jobs = await fetchJobsForCompany(supabase, ctx.tenantId, countByJob(await fetchCompanyReactions(supabase, ctx.tenantId)), views30d);
  /* ★部門の絞り込みの選択肢（2026-10-12）。求人の作成画面と同じ取り方（削除していない部門）。⚠️ 取れなければ null */
  const { data: deptRows, error: deptErr } = await supabase.from("ow_company_departments").select("id, name")
    .eq("company_id", ctx.tenantId).is("deleted_at", null).order("display_order").order("name");
  if (deptErr) console.error("[biz/jobs] departments:", deptErr.message);
  const departments = deptErr ? null : (deptRows ?? []).map((d) => ({ id: d.id as string, name: d.name as string }));

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <JobsClient jobs={jobs} isAdmin={ctx.currentPermission === "admin"} initialStatus={initialStatus} initialDept={initialDept} viewsFailed={!!viewErr} departments={departments} />
    </BusinessLayout>
  );
}
