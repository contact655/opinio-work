import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { getApproachQuota, listSentApproaches } from "@/lib/approaches/server";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import { ApproachesView } from "./ApproachesView";

export const dynamic = "force-dynamic";

/* ⚠️ サイドバーの「声かけ」と同じ名前にする */
export const metadata = {
  title: { absolute: "メッセージリクエスト | OPINIO Business" },
};

/**
 * ★企業が送った「声かけ」の一覧（2026-10-09）。
 *
 * ⚠️★状態は3つ（2026-10-10。言い方は 2026-10-11 に変更）:「返事待ち」「30日を過ぎました」「やり取り中」。判定は `companyApproachStatus`。
 *    **見送られたものは、30日以内は「返事待ち」、過ぎたら「30日を過ぎました」**（見送りは区別しない）
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

  /* ★0件のときだけ「いま声をかけられる候補者：N人」を数える（2026-10-11）。
        ⚠️★候補者検索と**同じ関数**（`loadCompanyCandidates` → `can_send_company_approach_many`）の
           `approach.eligible` を数える。人数が「声かけを受け取る方のみ」で絞った件数と食い違わないように。
        ⚠️ 判定を取れなかったら null（0人と出さない）。 */
  let approachableCount: number | null | undefined;
  if (allowed && rows !== null && rows.length === 0) {
    const { candidates } = await loadCompanyCandidates({ companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, planType: ctx.planType });
    approachableCount = candidates.length > 0 && candidates.every((c) => c.approach === undefined)
      ? null
      : candidates.filter((c) => c.approach?.eligible === true).length;
  }

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
      <ApproachesView allowed={allowed} rows={rows} quota={quota} sentId={searchParams?.sent} now={new Date().toISOString()} approachableCount={approachableCount} />
    </BusinessLayout>
  );
}
