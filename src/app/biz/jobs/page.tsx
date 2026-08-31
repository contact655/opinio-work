import { JobsClient } from "./JobsClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobsForCompany } from "@/lib/business/jobs";
import { JOB_STATUS_TABS, type JobStatus } from "@/lib/business/mockJobs";

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
 * ⚠️ 値は `JOB_STATUS_TABS` と突き合わせる。知らない値は `all` に落とす
 *   （URL の値をそのまま state に入れない）。
 * ⚠️ `useSearchParams()` をクライアント側で使う形にはしない。あれは静的生成時に
 *   最寄りの Suspense fallback で打ち切られる（`/jobs` で実際に踏んだ）。
 *   このページは `force-dynamic` だが、サーバーから props で渡すほうが素直。
 */
export default async function BizJobsPage({
  searchParams,
}: { searchParams?: { status?: string } }) {
  const raw = searchParams?.status;
  const initialStatus = (JOB_STATUS_TABS.some((t) => t.status === raw)
    ? raw
    : "all") as JobStatus | "all";
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const jobs = await fetchJobsForCompany(supabase, ctx.tenantId);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <JobsClient jobs={jobs} isAdmin={ctx.currentPermission === "admin"} initialStatus={initialStatus} />
    </BusinessLayout>
  );
}
