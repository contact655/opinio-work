import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchAgenciesForCompany } from "@/lib/business/agents";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentsClient } from "./AgentsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "エージェント管理 | OPINIO Business" },
};

export default async function BizAgentsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const admin = createAdminClient();
  const [agencies, jobsRes] = await Promise.all([
    fetchAgenciesForCompany(ctx.tenantId),
    admin
      .from("ow_jobs")
      .select("id, title")
      .eq("company_id", ctx.tenantId)
      .in("status", ["published", "active"])
      .order("created_at", { ascending: false }),
  ]);

  const jobs = (jobsRes.data ?? []).map((j) => ({ id: j.id, title: j.title }));

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <AgentsClient initialAgencies={agencies} jobs={jobs} />
    </BusinessLayout>
  );
}
