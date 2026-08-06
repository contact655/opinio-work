import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ProfileEditClient from "./ProfileEditClient";
import { type Stint } from "@/components/profile/CareerHistoryEditor";

export const metadata = { title: { absolute: "プロフィール設定 | OPINIO" }, robots: { index: false, follow: false } };

export default async function ProfileEditPage({
  searchParams,
}: {
  searchParams: { welcome?: string; tab?: string };
}) {
  const isWelcome = searchParams.welcome === "1";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/profile/edit");
  }

  /*
    ⚠️ birth_date / join_reason は 2026-08-06 に authenticated から SELECT 権限を剥がした。
       session クライアントの select に含めると **PostgREST がクエリごと 403 にする**ので、
       本人の行であっても丸ごと取れなくなる（画面は 200 のまま空になる）。
       ここは本人の行だけを扱う画面なので、admin クライアントで引く。
  */
  const adminSupabase = createAdminClient();
  const { data: owUser } = await adminSupabase
    .from("ow_users")
    .select("id, name, avatar_color, avatar_url, cover_color, cover_photo_url, visibility, location, birth_date, about_me, future_aspirations, is_open_to_work, social_links")
    .eq("auth_id", user.id)
    .maybeSingle();

  // 学歴 + 実績 + 受賞 + メディア掲載 + 職歴 + 職種マスター を並列取得
  const [
    { data: educationsRaw },
    { data: achievementsRaw },
    { data: awardsRaw },
    { data: mediaAppearancesRaw },
    { data: expRows },
    { data: allRoles },
    { data: roleAliasRows },
    { data: contentLinksRaw },
  ] = await Promise.all([
    owUser
      ? supabase
          .from("ow_user_educations")
          .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
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
      ? adminSupabase   // ⚠️ join_reason を含むので admin。対象は owUser.id に固定
          .from("ow_experiences")
          .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description, join_reason, employment_type")
          .eq("user_id", owUser.id)
          .order("is_current", { ascending: false })
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    /*
      職歴入力の選択肢。
      ⚠️ is_active = true で絞る（2026-08-06 に追加）。無効化・統合済みの職種を
         新規入力の候補に出さないため。
      ⚠️ is_it_saas では絞らない。過去職歴には非IT職が入るため
         （非IT系の大分類7件は is_it_saas = false で登録してある）。
      ⚠️ ここで絞った結果、**既に持っている職種が候補から消える**ことがある。
         そのまま編集画面を開くとセレクトが空になり、保存した瞬間に職種が失われる。
         下の allRoles で「現在選択中の職種」を必ず足し戻すこと。
    */
    supabase.from("ow_roles").select("id, name, parent_id, display_order").eq("is_active", true).order("display_order"),
    /*
      職種の別名（ow_role_aliases・120件）。検索でヒットさせるために全件渡す。
      ⚠️「法人営業」でフィールドセールスに当たらないと、標準職種の名前を知らない人が
         辿り着けない。ow_roles 99 + 別名 120 = 219件なので全件クライアント渡しでよい。
    */
    supabase.from("ow_role_aliases").select("role_id, alias"),
    owUser
      ? supabase
          .from("ow_user_content_links")
          .select("id, url, platform, title, description, thumbnail_url, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  /*
    Build typed roles array for dynamic dropdown (Phase 2-A)

    ⚠️ 既存の職歴が持っている職種は、is_active の条件から外れていても候補に残す。
       落とすと編集画面でセレクトが空になり、ユーザーが別項目だけ直して保存した瞬間に
       職種が失われる。統合・無効化を運用で回す以上、必ず起きる。
       ⚠️ 親も一緒に足すこと。子だけ足しても、親セレクトに親が無ければ子セレクトが開かない。
  */
  const activeRoleIds = new Set((allRoles ?? []).map((r) => r.id as string));
  const selectedRoleIds = Array.from(
    new Set(
      ((expRows ?? []) as { role_category_id?: string | null }[])
        .map((e) => e.role_category_id)
        .filter((id): id is string => !!id && !activeRoleIds.has(id)),
    ),
  );

  let extraRoles: Record<string, unknown>[] = [];
  if (selectedRoleIds.length > 0) {
    const { data: missing } = await supabase
      .from("ow_roles")
      .select("id, name, parent_id, display_order")
      .in("id", selectedRoleIds);
    extraRoles = (missing ?? []) as Record<string, unknown>[];

    // 親が候補に無いと子セレクトに到達できないので、親も足す
    const parentIds = Array.from(new Set(
      extraRoles.map((r) => r.parent_id as string | null)
        .filter((id): id is string => !!id && !activeRoleIds.has(id)),
    ));
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from("ow_roles")
        .select("id, name, parent_id, display_order")
        .in("id", parentIds);
      extraRoles = [...extraRoles, ...((parents ?? []) as Record<string, unknown>[])];
    }
  }

  /** role_id → 別名[]。RoleSearchSelect の検索対象にする */
  const roleAliasMap: Record<string, string[]> = {};
  for (const r of (roleAliasRows ?? []) as { role_id: string; alias: string }[]) {
    if (!roleAliasMap[r.role_id]) roleAliasMap[r.role_id] = [];
    roleAliasMap[r.role_id].push(r.alias);
  }

  const roles: { id: string; name: string; parent_id: string | null; display_order: number }[] =
    [...(allRoles ?? []), ...extraRoles].map((r) => ({
      id: r.id as string,
      name: r.name as string,
      parent_id: (r.parent_id as string | null) ?? null,
      display_order: (r.display_order as number) ?? 0,
    }));

  // ow_profiles — 希望条件 + スカウト設定
  let profilePrefs: {
    job_type: string | null;
    experience_years: string | null;
    desired_work_style: string | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    transfer_timing: string | null;
    desired_phase: string[] | null;
    worry: string | null;
    scout_enabled: boolean | null;
  } | null = null;

  if (owUser) {
    // onboarding は auth.users.id を user_id として保存する場合がある
    const { data: p1 } = await supabase
      .from("ow_profiles")
      .select("job_type, experience_years, desired_work_style, desired_salary_min, desired_salary_max, transfer_timing, desired_phase, worry, scout_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (p1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profilePrefs = p1 as any;
    } else {
      const { data: p2 } = await supabase
        .from("ow_profiles")
        .select("job_type, experience_years, desired_work_style, desired_salary_min, desired_salary_max, transfer_timing, desired_phase, worry, scout_enabled")
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
      startedAt: r.started_at ? (r.started_at as string).slice(0, 7) : "",
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: (r.description as string | null) ?? undefined,
      joinReason: (r.join_reason as string | null) ?? undefined,
      employmentType: (r.employment_type as string | null) ?? undefined,
    };
  });

  return (
    <ProfileEditClient
      owUser={owUser}
      authEmail={user.email ?? ""}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEducations={(educationsRaw ?? []) as any}
      initialSocialLinks={(owUser?.social_links as Record<string, string> | null) ?? {}}
      initialAchievements={achievementsRaw ?? []}
      initialAwards={awardsRaw ?? []}
      initialMediaAppearances={mediaAppearancesRaw ?? []}
      initialExperiences={initialExperiences}
      initialContentLinks={contentLinksRaw ?? []}
      roles={roles}
      roleAliases={roleAliasMap}
      initialTab={searchParams.tab}
      isWelcome={isWelcome}
      initialScoutEnabled={profilePrefs?.scout_enabled ?? null}
      initialProfilePrefs={profilePrefs}
    />
  );
}
