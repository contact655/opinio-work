import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { JobEditForm } from "@/components/business/JobEditForm";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobById, fetchTeamMembers } from "@/lib/business/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { RoleItem, DeptItem } from "@/components/business/JobEditForm";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: `求人編集 | OPINIO Business` };
}


export default async function JobEditPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const adminClient = createAdminClient();
  const [jobData, teamMembers, rolesResult, deptsResult] = await Promise.all([
    fetchJobById(supabase, params.id),
    fetchTeamMembers(supabase, ctx.tenantId),
    adminClient.from("ow_roles").select("id, parent_id, name, level").eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("ow_company_departments").select("id, parent_id, name, display_order").eq("company_id", ctx.tenantId).is("deleted_at", null).order("display_order").order("name"),
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

  if (jobData.companyId !== ctx.tenantId) {
    notFound();
  }

  const roles: RoleItem[] = (rolesResult.data ?? []) as RoleItem[];
  const departments: DeptItem[] = (deptsResult.data ?? []) as DeptItem[];
  const initialDepartmentId = (jobData.job as unknown as { department_id?: string | null }).department_id ?? null;

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
        initialJobRoles={jobData.jobRoles}
        companyId={ctx.tenantId}
        teamMembers={teamMembers}
        roles={roles}
        departments={departments}
        initialDepartmentId={initialDepartmentId}
      />
    </BusinessLayout>
  );
}
