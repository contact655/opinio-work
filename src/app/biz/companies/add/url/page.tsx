import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext, getBizUserName } from "@/lib/business/dashboard";
import { AddByUrlClient } from "./AddByUrlClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "招待 URL を入力 | OPINIO Business" },
};

export default async function AddByUrlPage() {
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
    >
      <AddByUrlClient />
    </BusinessLayout>
  );
}
