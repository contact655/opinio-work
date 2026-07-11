import { JobsClient } from "./JobsClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobsForCompany } from "@/lib/business/jobs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "求人管理 | OPINIO Business" },
};

export default async function BizJobsPage() {
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
      <JobsClient jobs={jobs} isAdmin={ctx.currentPermission === "admin"} />
    </BusinessLayout>
  );
}
