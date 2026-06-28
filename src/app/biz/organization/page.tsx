import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import {
  getCompanyEmployeeCategories,
  getAllRolesForCategoryEditor,
} from "@/lib/supabase/queries";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CategoriesEditor } from "./CategoriesEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "組織体制 | OPINIO Business" },
};

export default async function CategoriesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/dashboard");

  const [categories, allRoles] = await Promise.all([
    getCompanyEmployeeCategories(ctx.tenantId),
    getAllRolesForCategoryEditor(),
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
      <CategoriesEditor
        initialCategories={categories}
        allRoles={allRoles}
        companyId={ctx.tenantId}
      />
    </BusinessLayout>
  );
}
