import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { DepartmentsEditor } from "./DepartmentsEditor";
import type { Department } from "./DepartmentsEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "部門マスタ | OPINIO Business" },
};

export default async function OrganizationPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/dashboard");

  const supabase = createClient();
  const { data: departments } = await supabase
    .from("ow_company_departments")
    .select("id, parent_id, name, display_order")
    .eq("company_id", ctx.tenantId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <DepartmentsEditor
        initialDepartments={(departments ?? []) as Department[]}
      />
    </BusinessLayout>
  );
}
