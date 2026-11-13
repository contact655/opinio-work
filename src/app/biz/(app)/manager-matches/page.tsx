import { can } from "@/lib/auth/roles";
import { guardBizPage } from "@/lib/auth/companyAccess";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { listCompanyMatches } from "@/lib/nextManager/server";
import ManagerMatchesClient from "./ManagerMatchesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "候補者管理 | OPINIO Business" },
};

/**
 * ★候補者管理（Next Manager / 2026-11-13）。採用中のマネージャーがマッチングした人と、面談の記録。
 *
 *   見える範囲: 管理者・採用担当は全件（managerMatches.viewAll）。ほかの役割は自分が担当の記録だけ
 *   （managerMatches.viewOwn）。⚠️ 自分の分だけのときは、ほかのマネージャーの人数も出さない。
 *   引き継ぎ（担当の付け替え）は管理者だけ（managerMatches.handover）。
 *
 * ⚠️★メッセージ本文はこの画面に一切出さない（会社には共有しない）。記録に本文の列は無い。
 * ⚠️ 読みは getTenantContext で所属を確かめたあと、admin クライアント経由（表は権限0・ポリシー0本）。
 * ⚠️ loading.tsx を置かない（ソフト200）。
 */
export default async function ManagerMatchesPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  guardBizPage(ctx.currentPermission, "managerMatches.viewAll", "managerMatches.viewOwn");

  const viewAll = can(ctx.currentPermission, "managerMatches.viewAll");
  const view = await listCompanyMatches(ctx.tenantId, viewAll ? null : ctx.currentOwnId);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <ManagerMatchesClient
        view={view}
        viewAll={viewAll}
        canHandover={can(ctx.currentPermission, "managerMatches.handover")}
      />
    </BusinessLayout>
  );
}
