import { JobsMockView } from "./JobsMockView";
import { JobsClient } from "./JobsClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobsForCompany } from "@/lib/business/jobs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "求人管理 | Opinio Business",
};

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
        企業アカウントが必要です
      </div>
    </BusinessLayout>
  );
}

export default async function BizJobsPage() {
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
    return <JobsMockView />;
  }

  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  const supabase = createClient();
  const jobs = await fetchJobsForCompany(supabase, ctx.tenantId);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      planType={ctx.planType}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <JobsClient jobs={jobs} />
    </BusinessLayout>
  );
}
