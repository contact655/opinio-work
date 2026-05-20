import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditClient from "./ProfileEditClient";
import { type Stint } from "@/components/profile/CareerHistoryEditor";

// ow_roles.name (DB) → slug (client) — same mapping as /api/jobseeker/experiences/route.ts
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

export const metadata = { title: "設定 — OPINIO" };

export default async function ProfileEditPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/profile/edit");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, cover_color, visibility, location, birth_date, about_me, future_aspirations, social_links")
    .eq("auth_id", user.id)
    .maybeSingle();

  // スキルタグ + 学歴 + 資格 + 実績 + 受賞 + メディア掲載 + 職歴 + 職種マスター を並列取得
  const [
    { data: skillTagsRaw },
    { data: educationsRaw },
    { data: certificationsRaw },
    { data: achievementsRaw },
    { data: awardsRaw },
    { data: mediaAppearancesRaw },
    { data: expRows },
    { data: allRoles },
  ] = await Promise.all([
    owUser
      ? supabase
          .from("ow_user_skill_tags")
          .select("id, label, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_educations")
          .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_certifications")
          .select("id, name, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_achievements")
          .select("id, title, value, unit, description, period_start, period_end, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_awards")
          .select("id, title, issuer, awarded_at, description, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_media_appearances")
          .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_experiences")
          .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description")
          .eq("user_id", owUser.id)
          .order("is_current", { ascending: false })
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("ow_roles").select("id, name, parent_id, display_order").order("display_order"),
  ]);

  // Build typed roles array for dynamic dropdown (Phase 2-A)
  const roles: { id: string; name: string; parent_id: string | null; display_order: number }[] =
    (allRoles ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      parent_id: (r.parent_id as string | null) ?? null,
      display_order: (r.display_order as number) ?? 0,
    }));

  // Build UUID → { slug, label } map from ow_roles
  const roleInfoById = new Map<string, { slug: string; label: string }>();
  for (const role of allRoles ?? []) {
    const slug = DB_NAME_TO_SLUG[role.name as string];
    if (slug) roleInfoById.set(role.id as string, { slug, label: role.name as string });
  }

  // Resolve company display names for master entries (SSR: name only, no logo needed here)
  const masterCompanyIds = (expRows ?? [])
    .filter((r) => r.company_id)
    .map((r) => r.company_id as string);
  const companyNameMap = new Map<string, string>();
  if (masterCompanyIds.length > 0) {
    const { data: companies } = await supabase
      .from("ow_companies")
      .select("id, name")
      .in("id", masterCompanyIds);
    for (const c of companies ?? []) {
      companyNameMap.set(c.id as string, c.name as string);
    }
  }

  // Map raw DB rows to Stint[] (same logic as GET /api/jobseeker/experiences)
  const initialExperiences: Stint[] = (expRows ?? []).map((r) => {
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
    const roleInfo = roleInfoById.get(roleUuid);
    return {
      id: r.id as string,
      displayCompanyName,
      companyType,
      companyId: (r.company_id as string | null) ?? undefined,
      companyText: (r.company_text as string | null) ?? undefined,
      companyAnonymized: (r.company_anonymized as string | null) ?? undefined,
      roleCategoryId: roleInfo?.slug ?? roleUuid,
      roleLabel: roleInfo?.label ?? roleUuid,
      roleTitle: (r.role_title as string | null) ?? undefined,
      startedAt: (r.started_at as string).slice(0, 7),
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: (r.description as string | null) ?? undefined,
    };
  });

  return (
    <ProfileEditClient
      owUser={owUser}
      authEmail={user.email ?? ""}
      initialSkillTags={skillTagsRaw ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEducations={(educationsRaw ?? []) as any}
      initialCertifications={certificationsRaw ?? []}
      initialSocialLinks={(owUser?.social_links as Record<string, string> | null) ?? {}}
      initialAchievements={achievementsRaw ?? []}
      initialAwards={awardsRaw ?? []}
      initialMediaAppearances={mediaAppearancesRaw ?? []}
      initialExperiences={initialExperiences}
      roles={roles}
    />
  );
}
