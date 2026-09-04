import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext, getBizUserName } from "@/lib/business/dashboard";
import { AddByTokenClient } from "./AddByTokenClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "招待コードを入力 | OPINIO Business" },
};

export default async function AddByTokenPage() {
  /* ⚠️ 所属が無くても表示する。**このページは「これから参加する人」のためのもの**で、
        所属を要求すると招待コードを受け取った人が入力画面に入れない（2026-08-14 修正）。 */
  const ctx = await getTenantContext();
  const userName = ctx?.userName ?? (await getBizUserName());

  return (
    <BusinessLayout
      userName={userName}
      tenantName={ctx?.tenantName}
      tenantLogoGradient={ctx?.logoGradient}
      tenantLogoLetter={ctx?.logoLetter}
      memberships={ctx?.allCompanies}
      currentTenantId={ctx?.tenantId}
      hasCompany={!!ctx}
    >
      <AddByTokenClient />
    </BusinessLayout>
  );
}
