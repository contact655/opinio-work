import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { getApproachQuota, listSentApproaches } from "@/lib/approaches/server";
import { ApproachesView } from "./ApproachesView";

export const dynamic = "force-dynamic";

/* ⚠️ サイドバーの「声かけ」と同じ名前にする */
export const metadata = {
  title: { absolute: "声かけ | OPINIO Business" },
};

/**
 * ★企業が送った「声かけ」の一覧（2026-10-09）。
 *
 * ⚠️★状態は3つ（2026-10-10）:「承認待ち」「30日を過ぎました」「やり取り中」。判定は `companyApproachStatus`。
 *    **見送られたものは、30日以内は「承認待ち」、過ぎたら「30日を過ぎました」**（見送りは区別しない）
 *    （求職者が見送ったことは企業に伝えない決まり）。`listSentApproaches` は declined_at を読まない。
 * ⚠️ 送る入口はここではなく、候補者検索のカード・右のプレビュー・/u/[id]（その人を見たうえで送るため）。書く画面は /biz/approaches/new。
 */
export default async function BizApproachesPage({ searchParams }: { searchParams?: { sent?: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const allowed = canUse(ctx.planType, "companyApproach");
  const [rows, quota] = allowed
    ? await Promise.all([listSentApproaches(ctx.tenantId), getApproachQuota(ctx.tenantId)])
    : [[], null];

  const layoutProps = {
    userName: ctx.userName,
    tenantName: ctx.tenantName,
    tenantLogoGradient: ctx.logoGradient,
    tenantLogoLetter: ctx.logoLetter,
    memberships: ctx.allCompanies,
    currentTenantId: ctx.tenantId,
  };

  return (
    <BusinessLayout {...layoutProps}>
      <ApproachesView allowed={allowed} rows={rows} quota={quota} sentId={searchParams?.sent} now={new Date().toISOString()} />
    </BusinessLayout>
  );
}
