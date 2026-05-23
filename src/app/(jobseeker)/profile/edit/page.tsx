import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditClient from "./ProfileEditClient";
import { type Stint } from "@/components/profile/CareerHistoryEditor";

export const metadata = { title: "プロフィール設定 — OPINIO" };

export default async function ProfileEditPage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const isWelcome = searchParams.welcome === "1";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/profile/edit");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, avatar_url, cover_color, cover_photo_url, visibility, location, birth_date, about_me, future_aspirations, social_links")
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

  // ow_profiles — 希望条件（job_type, desired_work_style, desired_salary, transfer_timing）
  let profilePrefs: {
    job_type: string | null;
    experience_years: string | null;
    desired_work_style: string | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    transfer_timing: string | null;
    desired_phase: string[] | null;
    worry: string | null;
  } | null = null;

  if (owUser) {
    // onboarding は auth.users.id を user_id として保存する場合がある
    const { data: p1 } = await supabase
      .from("ow_profiles")
      .select("job_type, experience_years, desired_work_style, desired_salary_min, desired_salary_max, transfer_timing, desired_phase, worry")
      .eq("user_id", user.id)
      .maybeSingle();

    if (p1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profilePrefs = p1 as any;
    } else {
      const { data: p2 } = await supabase
        .from("ow_profiles")
        .select("job_type, experience_years, desired_work_style, desired_salary_min, desired_salary_max, transfer_timing, desired_phase, worry")
        .eq("user_id", owUser.id)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (p2) profilePrefs = p2 as any;
    }
  }

  // Build UUID → name map from ow_roles
  const roleNameById = new Map<string, string>();
  for (const role of allRoles ?? []) {
    roleNameById.set(role.id as string, role.name as string);
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
    return {
      id: r.id as string,
      displayCompanyName,
      companyType,
      companyId: (r.company_id as string | null) ?? undefined,
      companyText: (r.company_text as string | null) ?? undefined,
      companyAnonymized: (r.company_anonymized as string | null) ?? undefined,
      roleCategoryId: roleUuid,
      roleLabel: roleNameById.get(roleUuid) ?? roleUuid,
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
      isWelcome={isWelcome}
      initialProfilePrefs={profilePrefs}
    />
  );
}
