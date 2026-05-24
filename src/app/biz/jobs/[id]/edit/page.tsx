import { JobEditMockView } from "./JobEditMockView";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { JobEditForm } from "@/components/business/JobEditForm";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobById, fetchTeamMembers } from "@/lib/business/jobs";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: `求人編集 | OPINIO Business` };
}


export default async function JobEditPage({ params }: { params: { id: string } }) {
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
    return <JobEditMockView jobId={params.id} />;
  }

  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const [jobData, teamMembers] = await Promise.all([
    fetchJobById(supabase, params.id),
    fetchTeamMembers(supabase, ctx.tenantId),
  ]);

  if (!jobData) {
    return (
      <BusinessLayout userName={ctx.userName} variant="fullBleed">
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
          求人が見つかりませんでした
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      variant="fullBleed"
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <JobEditForm
        mode="edit"
        initialJob={jobData.job}
        initialAssigneeIds={jobData.assigneeIds}
        companyId={ctx.tenantId}
        teamMembers={teamMembers}
      />
    </BusinessLayout>
  );
}
