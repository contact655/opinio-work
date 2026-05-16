import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";
import { createClient } from "@/lib/supabase/server";
import { CompanyEditClient } from "./CompanyEditClient";
import type { Genre } from "@/components/ui/GenreChipSelector";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "企業情報編集 | OPINIO Business",
};

export default async function BizCompanyPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/auth");

  const supabase = createClient();

  // ow_genres（全件）と公開済みジャンル（ow_company_genres）をオフィス写真と並列取得
  const [initialPhotos, genresResult, publishedGenresResult] = await Promise.all([
    fetchOfficePhotosForCompany(supabase, ctx.tenantId),
    supabase
      .from("ow_genres")
      .select("slug, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("ow_company_genres")
      .select("ow_genres(slug)")
      .eq("company_id", ctx.tenantId)
      .eq("is_human_approved", true),
  ]);

  // 公開済みジャンルの slug 配列（draft_data.genres がない企業の初期値として使用）
  const publishedGenreSlugs: string[] = ((publishedGenresResult.data ?? []) as Record<string, unknown>[])
    .map((row) => (row.ow_genres as Record<string, string> | null)?.slug)
    .filter((s): s is string => typeof s === "string");

  // company 取得（transformDbToForm 内で draft_data.genres → publishedGenreSlugs の優先順位で genres を解決）
  const company = await fetchCompanyForTenant(supabase, ctx.tenantId, publishedGenreSlugs);
  if (!company) redirect("/biz/auth");

  const availableGenres: Genre[] = (genresResult.data ?? []) as Genre[];

  return (
    <CompanyEditClient
      initialCompany={company}
      initialPhotos={initialPhotos}
      companyId={ctx.tenantId}
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient ?? undefined}
      tenantLogoLetter={ctx.logoLetter ?? undefined}
      memberships={ctx.allCompanies}
      isAdmin={ctx.currentPermission === "admin"}
      availableGenres={availableGenres}
    />
  );
}
