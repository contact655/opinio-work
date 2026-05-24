import { JobsMockView } from "./JobsMockView";
import { JobsClient } from "./JobsClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobsForCompany } from "@/lib/business/jobs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "求人管理 | OPINIO Business",
};

export default async function BizJobsPage() {
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
    return <JobsMockView />;
  }

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
