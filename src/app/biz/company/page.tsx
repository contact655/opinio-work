import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";
import { createClient } from "@/lib/supabase/server";
import { CompanyEditClient } from "./CompanyEditClient";
import type { Genre } from "@/components/ui/GenreChipSelector";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "企業情報編集 | OPINIO Business" },
};

export default async function BizCompanyPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/dashboard");

  const supabase = createClient();

  // 全クエリを並列取得（company は genres に依存しないため同時実行）
  // 規約同意記録を確認（ow_terms_agreements）
  const { data: { user } } = await supabase.auth.getUser();
  const adminClient = createAdminClient();
  const { data: existingAgreement } = user
    ? await adminClient
        .from("ow_terms_agreements")
        .select("id")
        .eq("user_id", user.id)
        .eq("terms_type", "business")
        .limit(1)
        .maybeSingle()
    : { data: null };
  const termsAgreed = !!existingAgreement;

  const [initialPhotos, genresResult, publishedGenresResult, companyRaw, industriesResult, saasCatsResult] = await Promise.all([
    fetchOfficePhotosForCompany(supabase, ctx.tenantId),
    adminClient
      .from("ow_genres")
      .select("slug, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from("ow_company_genres")
      .select("ow_genres(slug)")
      .eq("company_id", ctx.tenantId)
      .eq("is_human_approved", true),
    fetchCompanyForTenant(supabase, ctx.tenantId, []),
    adminClient
      .from("ow_industries")
      .select("id, parent_id, name, slug, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    adminClient
      .from("ow_saas_categories")
      .select("id, name, slug, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  if (!companyRaw) redirect("/biz/dashboard");

  // 公開済みジャンルの slug 配列（draft_data.genres がない企業の初期値として使用）
  const publishedGenreSlugs: string[] = ((publishedGenresResult.data ?? []) as Record<string, unknown>[])
    .map((row) => (row.ow_genres as Record<string, string> | null)?.slug)
    .filter((s): s is string => typeof s === "string");

  // draft_data に genres がなければ公開済みジャンルで補完
  const company = companyRaw.genres.length === 0 && publishedGenreSlugs.length > 0
    ? { ...companyRaw, genres: publishedGenreSlugs }
    : companyRaw;

  const availableGenres: Genre[] = (genresResult.data ?? []) as Genre[];

  type IndustryItem = { id: string; parent_id: string | null; name: string; slug: string; display_order: number };
  type SaasCatItem = { id: string; name: string; slug: string; display_order: number };

  const industries: IndustryItem[] = (industriesResult.data ?? []) as IndustryItem[];
  const saasCategories: SaasCatItem[] = (saasCatsResult.data ?? []) as SaasCatItem[];

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
      initialTermsAgreed={termsAgreed}
      userId={user?.id ?? ""}
      industries={industries}
      saasCategories={saasCategories}
    />
  );
}
