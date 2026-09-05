import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { DepartmentsEditor } from "./DepartmentsEditor";
import { JobRolesEditor } from "./JobRolesEditor";
import { OrganizationTabs } from "./OrganizationTabs";
import type { Department } from "./DepartmentsEditor";
import type { CompanyJobRole, StandardRole } from "./JobRolesEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "組織マスタ | OPINIO Business" },
};

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/dashboard");

  const activeTab = searchParams?.tab === "roles" ? "roles" : "departments";

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const [deptResult, jobRolesResult, stdRolesResult] = await Promise.all([
    supabase
      .from("ow_company_departments")
      .select("id, parent_id, name, display_order")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),

    supabase
      .from("ow_company_job_roles")
      .select("id, name, standard_role_id, display_order")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),

    adminSupabase
      .from("ow_roles")
      /* ★`display_order` も取る（2026-09-05）。⚠️ **親ごとの相対順**なので、
            この order だけでは親子が混ざる。木に組むのは `StandardRoleCombobox` 側。 */
      .select("id, name, parent_id, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 32px 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px", fontFamily: "var(--font-noto-serif)" }}>
          組織体制
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 24px" }}>
          求人・社員登録で使用する部門と職種の定義を管理します。
        </p>
        <OrganizationTabs activeTab={activeTab} />
      </div>

      {activeTab === "departments" ? (
        <DepartmentsEditor
          initialDepartments={(deptResult.data ?? []) as Department[]}
        />
      ) : (
        <JobRolesEditor
          initialRoles={(jobRolesResult.data ?? []) as CompanyJobRole[]}
          standardRoles={(stdRolesResult.data ?? []) as StandardRole[]}
        />
      )}
    </BusinessLayout>
  );
}
