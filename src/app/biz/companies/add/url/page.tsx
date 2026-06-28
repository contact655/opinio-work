import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { AddByUrlClient } from "./AddByUrlClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "招待 URL を入力 | OPINIO Business" },
};

export default async function AddByUrlPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <AddByUrlClient />
    </BusinessLayout>
  );
}
