import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";
import { createClient } from "@/lib/supabase/server";
import { CompanyEditClient } from "./CompanyEditClient";
import type { Genre } from "@/components/ui/GenreChipSelector";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcDisclosureScore } from "@/lib/utils/disclosureScore";

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

  const [initialPhotos, genresResult, publishedGenresResult, companyRaw, industriesResult, saasCatsResult, jobCntResult, storyCntResult, interviewScoreData] = await Promise.all([
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
    adminClient.from("ow_jobs").select("id", { count: "exact", head: true }).eq("company_id", ctx.tenantId).eq("status", "published"),
    adminClient.from("ow_company_posts").select("id", { count: "exact", head: true }).eq("company_id", ctx.tenantId).eq("is_published", true),
    // 取材項目スコア用フィールドを一括取得
    adminClient.from("ow_companies").select("description, culture_description, customer_cases, market_customer_size, capital_type, branch_locations, org_teams").eq("id", ctx.tenantId).maybeSingle(),
  ]);

  if (!companyRaw) redirect("/biz/dashboard");

  // 取材項目スコアを計算（サーバー側で完結させる）
  const iFields = interviewScoreData.data;
  const [{ count: toolCount }, { count: salaryCount }] = await Promise.all([
    adminClient.from("ow_company_tools").select("*", { count: "exact", head: true }).eq("company_id", ctx.tenantId),
    adminClient.from("ow_salary_reports").select("*", { count: "exact", head: true }).eq("company_id", ctx.tenantId).eq("is_approved", true),
  ]);
  const interviewScore = calcDisclosureScore({
    cultureDescription: iFields?.culture_description ?? null,
    customerCases: Array.isArray(iFields?.customer_cases) ? iFields.customer_cases : null,
    marketCustomerSize: iFields?.market_customer_size as string[] | null ?? null,
    capitalType: iFields?.capital_type ?? null,
    branchLocations: iFields?.branch_locations as string[] | null ?? null,
    orgTeams: Array.isArray(iFields?.org_teams) ? iFields.org_teams : null,
    toolCount: toolCount ?? 0,
    salaryReportCount: salaryCount ?? 0,
  }).interview;

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
      initialPublishedJobCount={jobCntResult.count ?? 0}
      initialPublishedStoryCount={storyCntResult.count ?? 0}
      initialInterviewScore={interviewScore}
      initialDescription={iFields?.description ?? null}
    />
  );
}
