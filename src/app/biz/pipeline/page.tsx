import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { PipelineClient } from "./PipelineClient";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchPipelineData } from "@/lib/business/pipeline";
import { fetchAgenciesForCompany } from "@/lib/business/agents";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "パイプライン | OPINIO Business",
};

export default async function BizPipelinePage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const [{ stages, candidates, jobs }, agencies] = await Promise.all([
    fetchPipelineData(ctx.tenantId),
    fetchAgenciesForCompany(ctx.tenantId),
  ]);

  const agencyOptions = agencies
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, agencyName: a.agencyName }));

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <PipelineClient
        initialStages={stages}
        initialCandidates={candidates}
        jobs={jobs}
        agencies={agencyOptions}
      />
    </BusinessLayout>
  );
}
