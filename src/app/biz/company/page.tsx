import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";
import { createClient } from "@/lib/supabase/server";
import { CompanyEditClient } from "./CompanyEditClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "企業情報編集 | Opinio Business",
};

export default async function BizCompanyPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/auth");

  const supabase = createClient();
  const [company, initialPhotos] = await Promise.all([
    fetchCompanyForTenant(supabase, ctx.tenantId),
    fetchOfficePhotosForCompany(supabase, ctx.tenantId),
  ]);
  if (!company) redirect("/biz/auth");

  return (
    <CompanyEditClient
      initialCompany={company}
      initialPhotos={initialPhotos}
      companyId={ctx.tenantId}
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient ?? undefined}
      tenantLogoLetter={ctx.logoLetter ?? undefined}
      planType={ctx.planType}
    />
  );
}
