import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { JobEditForm } from "@/components/business/JobEditForm";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchTeamMembers } from "@/lib/business/jobs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "求人を作成 | OPINIO Business" },
};

export default async function JobNewPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";

  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage userName={userName} />;

  const teamMembers = await fetchTeamMembers(supabase, ctx.tenantId);

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
        mode="new"
        companyId={ctx.tenantId}
        teamMembers={teamMembers}
      />
    </BusinessLayout>
  );
}
