import { JobEditMockView } from "./JobEditMockView";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { JobEditForm } from "@/components/business/JobEditForm";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobById, fetchTeamMembers } from "@/lib/business/jobs";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: `求人編集 | Opinio Business` };
}

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName} variant="fullBleed">
      <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
        企業アカウントが必要です
      </div>
    </BusinessLayout>
  );
}

export default async function JobEditPage({ params }: { params: { id: string } }) {
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
    return <JobEditMockView jobId={params.id} />;
  }

  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

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
      planType={ctx.planType}
      variant="fullBleed"
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
