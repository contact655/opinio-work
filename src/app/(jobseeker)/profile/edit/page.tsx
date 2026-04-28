import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditClient from "./ProfileEditClient";
import type { Experience } from "./mockProfileData";

export const metadata = { title: "プロフィール編集 — Opinio" };

// DB_NAME_TO_SLUG duplicated here to avoid importing API-route code
const DB_NAME_TO_SLUG: Record<string, string> = {
  "営業": "sales", "PdM / PM": "pm", "カスタマーサクセス": "cs",
  "エンジニア": "engineer", "マーケティング": "marketing", "経営・CxO": "exec", "その他": "other",
  "フィールドセールス": "field_sales", "エンタープライズ営業": "enterprise_sales",
  "インサイドセールス": "inside_sales", "SDR / BDR": "sdr_bdr",
  "プロダクトマネージャー": "product_manager", "プロダクトオーナー": "product_owner", "PMM": "pmm",
  "バックエンド": "backend", "フロントエンド": "frontend", "フルスタック": "fullstack",
  "SRE / インフラ": "sre", "iOS / Android": "ios_android",
  "CEO": "ceo", "COO": "coo", "CPO": "cpo", "CTO": "cto", "CFO": "cfo",
  "デザイナー": "designer", "事業開発": "biz_dev", "HRBP": "hrbp",
  "コーポレート": "corporate", "データサイエンティスト": "data_scientist",
};

export default async function ProfileEditPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/profile/edit");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, cover_color, about_me, age_range, location, social_links, visibility")
    .eq("auth_id", user.id)
    .maybeSingle();

  const [expResult, { data: allRoles }] = await Promise.all([
    owUser?.id
      ? supabase
          .from("ow_experiences")
          .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description")
          .eq("user_id", owUser.id)
          .order("is_current", { ascending: false })
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: null }),
    supabase.from("ow_roles").select("id, name"),
  ]);
  const expRows = expResult.data;

  // Build UUID → slug map
  const uuidToSlug = new Map<string, string>();
  for (const role of allRoles ?? []) {
    const slug = DB_NAME_TO_SLUG[role.name as string];
    if (slug) uuidToSlug.set(role.id as string, slug);
  }

  // Resolve company names for master entries
  const companyIds = (expRows ?? [])
    .filter((r) => r.company_id)
    .map((r) => r.company_id as string);
  const companyNameMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("ow_companies")
      .select("id, name")
      .in("id", companyIds);
    for (const c of companies ?? []) {
      companyNameMap.set(c.id as string, c.name as string);
    }
  }

  const initialExperiences: Experience[] = (expRows ?? []).map((r) => {
    let companyType: "master" | "custom" | "anon";
    let displayCompanyName: string;
    if (r.company_id) {
      companyType = "master";
      displayCompanyName = companyNameMap.get(r.company_id as string) ?? "不明な企業";
    } else if (r.company_text) {
      companyType = "custom";
      displayCompanyName = r.company_text as string;
    } else {
      companyType = "anon";
      displayCompanyName = (r.company_anonymized as string) ?? "非公開企業";
    }
    const roleUuid = r.role_category_id as string;
    return {
      id: r.id as string,
      companyType,
      companyId: r.company_id as string | undefined || undefined,
      companyText: r.company_text as string | undefined || undefined,
      companyAnonymized: r.company_anonymized as string | undefined || undefined,
      displayCompanyName,
      roleCategoryId: uuidToSlug.get(roleUuid) ?? roleUuid,
      roleTitle: r.role_title as string | undefined || undefined,
      startedAt: (r.started_at as string).slice(0, 7),
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: r.description as string | undefined || undefined,
    };
  });

  return (
    <ProfileEditClient
      owUser={owUser}
      authEmail={user.email ?? ""}
      initialExperiences={initialExperiences}
    />
  );
}
