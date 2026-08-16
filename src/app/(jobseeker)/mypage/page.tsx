import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFollowCounts } from "@/lib/people/followCounts";
import { canUserPost } from "@/lib/feed/canPost";
import { createAdminClient } from "@/lib/supabase/admin";
import MypageClient from "./MypageClient";
import type { CareerEntry } from "@/components/profile/MergedTimeline";
import {
  buildTimelineCareerEntriesFromRaw,
  type RawExperienceRow,
  type CompanyLogoInfo,
} from "@/lib/utils/timeline";
/* ⚠️ プロフィール編集の中身は 2026-08-16 に `/profile/edit` からここへ移した。
      取得もこのファイルに寄せる。**2ページで同じ行を別々に引かない。** */
import { type Stint } from "@/components/profile/CareerHistoryEditor";
import { EXPERIENCE_EDITOR_COLS } from "@/lib/experiences/columns";

export const metadata = { title: { absolute: "マイページ | OPINIO" }, robots: { index: false, follow: false } };

export default async function MypagePage({
  searchParams,
}: {
  /* ⚠️ `setup` は 2026-08-10 に削除した。`?setup=done` を付ける経路が
        どこにも無く（/profile/start が存在しないため）、到達不能だった。 */
  searchParams?: { welcome?: string; tab?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/mypage");
  }

  /* ⚠️ birth_date は 2026-08-06 に authenticated から SELECT 権限を剥がした。
        session クライアントの select に含めると PostgREST がクエリごと 403 にし、
        owUser が null になってダッシュボードが丸ごと空になる（画面は 200 のまま）。
        本人の行だけを扱うので admin で引く。 */
  const { data: owUser } = await createAdminClient()
    .from("ow_users")
    /* ⚠️ 列は「ダッシュボードの表示」と「プロフィール編集」の**両方**をまかなう。
          編集側だけが使う cover_photo_url / visibility を落とすと、
          写真カードと公開範囲が空で初期化され、保存した瞬間に消える。 */
    .select("id, name, avatar_color, avatar_url, cover_color, cover_photo_url, visibility, headline, about_me, birth_date, location, social_links, future_aspirations, is_open_to_work, profile_setup_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  /* フォロー数。0 の項目は FollowCounts 側で落とすのでここでは素通し。
     ⚠️ 単独で await せず、下の Promise.all に相乗りさせる（2026-08-09）。
        owUser.id しか要らないので、学歴・職歴と同時に取れる。 */
  let followCounts: Awaited<ReturnType<typeof getFollowCounts>> = { followers: 0, following: 0 };

  // Fetch educations + experiences + roles in parallel
  let educations: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[] = [];
  let timelineCareers: CareerEntry[] = [];
  /* ── プロフィール編集にだけ要るもの（2026-08-16 に /profile/edit から移設）── */
  let achievementsRaw: Record<string, unknown>[] = [];
  let awardsRaw: Record<string, unknown>[] = [];
  let mediaAppearancesRaw: Record<string, unknown>[] = [];
  let contentLinksRaw: Record<string, unknown>[] = [];
  let desiredRoleIds: string[] = [];
  const roleAliasMap: Record<string, string[]> = {};
  let editorRoles: { id: string; name: string; parent_id: string | null; display_order: number }[] = [];
  let desiredRoleOptions: typeof editorRoles = [];
  let initialExperiences: Stint[] = [];
  if (owUser) {
    const [
      { data: edus },
      { data: expRows },
      { data: allRoles },
      followCountsResult,
      { data: achRows },
      { data: awdRows },
      { data: medRows },
      { data: linkRows },
      { data: desiredRoleRows },
      { data: roleAliasRows },
    ] = await Promise.all([
      supabase
        .from("ow_user_educations")
        .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
        .eq("user_id", owUser.id)
        .order("sort_order", { ascending: true }),
      /* ⚠️ **admin で引く。** session クライアントだと join_reason / 年収4列で
            クエリごと 403 になり、職歴が丸ごと消える（画面は 200 のまま空になる）。
            編集側は join_reason 等を必要とするので、表示用に列を削るのではなく
            admin に寄せる。対象は owUser.id に固定。
         ⚠️ 列リストは lib/experiences/columns.ts の1箇所に置く。ここに直書きしない。
            選び忘れた列は編集画面で空になり、**保存した瞬間に消える**。 */
      createAdminClient()
        .from("ow_experiences")
        .select(EXPERIENCE_EDITOR_COLS)
        .eq("user_id", owUser.id)
        .order("is_current", { ascending: false })
        .order("started_at", { ascending: false }),
      /* ⚠️ **絞らずに全件引く。** ここ1本から3つの用途を作る:
            ① 経歴タイムラインの職種名（無効化された職種も名前が要る）
            ② 編集フォームの候補（is_active で絞る＋本人が持っている職種を足し戻す）
            ③ 希望職種の候補（is_it_saas で絞る）
            以前は同じ表を **5回**引いていた（絞り込み違いで4本＋表示用1本）。 */
      supabase
        .from("ow_roles")
        .select("id, name, parent_id, display_order, is_active, is_it_saas"),
      getFollowCounts(owUser.id),
      /* ⚠️ 実績・受賞・メディア・発信コンテンツは**行ごと**引く。
            以前は /mypage が count だけ、/profile/edit が行を引いていて二重だった。
            **件数は行の長さから出す。** */
      supabase
        .from("ow_user_achievements")
        .select("id, title, value, unit, description, period_start, period_end, sort_order, experience_id")
        .eq("user_id", owUser.id).order("sort_order", { ascending: true }),
      supabase
        .from("ow_user_awards")
        .select("id, title, issuer, awarded_at, description, sort_order, experience_id")
        .eq("user_id", owUser.id).order("sort_order", { ascending: true }),
      supabase
        .from("ow_user_media_appearances")
        .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
        .eq("user_id", owUser.id).order("sort_order", { ascending: true }),
      supabase
        .from("ow_user_content_links")
        .select("id, url, platform, title, description, thumbnail_url, sort_order")
        .eq("user_id", owUser.id).order("sort_order", { ascending: true }),
      /* ⚠️ `ow_profile_desired_roles.user_id` は **auth.users.id**（ow_users.id ではない） */
      supabase.from("ow_profile_desired_roles").select("role_id").eq("user_id", user.id),
      /* 職種の別名（120件）。検索でヒットさせるために全件渡す */
      supabase.from("ow_role_aliases").select("role_id, alias"),
    ]);

    followCounts = followCountsResult;

    educations = (edus ?? []).map((e) => ({
      id: e.id as string,
      school: e.school as string,
      school_id: (e.school_id as string | null) ?? null,
      school_master: (e.school_master as unknown as { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null) ?? null,
      faculty: (e.faculty as string | null) ?? null,
      degree: (e.degree as string | null) ?? null,
      enrolled_at: (e.enrolled_at as string | null) ?? null,
      graduated_at: (e.graduated_at as string | null) ?? null,
      is_current: e.is_current as boolean,
      sort_order: e.sort_order as number,
    }));

    // ロール情報 Map（職種名 + 親カテゴリ名）
    const roleByIdRaw = new Map<string, { name: string; parent_id: string | null }>();
    for (const role of (allRoles ?? []) as { id: string; name: string; parent_id: string | null }[]) {
      roleByIdRaw.set(role.id, { name: role.name, parent_id: role.parent_id });
    }
    const roleNameById = new Map(
      Array.from(roleByIdRaw.entries()).map(([id, r]) => [
        id,
        {
          name: r.name,
          parent_name: r.parent_id ? (roleByIdRaw.get(r.parent_id)?.name ?? null) : null,
        },
      ])
    );

    // master 企業の会社名 + ロゴ 3 フィールドを二次取得（A-1: logo_url / logo_letter / logo_gradient 追加）
    const masterCompanyIds = (expRows ?? [])
      .filter((r) => r.company_id)
      .map((r) => r.company_id as string);
    const companyInfoById = new Map<string, CompanyLogoInfo>();
    if (masterCompanyIds.length > 0) {
      const { data: companies } = await supabase
        .from("ow_companies")
        .select("id, name, logo_url, logo_letter, logo_gradient, industry, phase, employee_count, is_published")
        .in("id", masterCompanyIds);
      for (const c of companies ?? []) {
        companyInfoById.set(c.id as string, {
          name: c.name as string,
          logoUrl: (c.logo_url as string | null) ?? null,
          logoLetter: (c.logo_letter as string | null) ?? null,
          logoGradient: (c.logo_gradient as string | null) ?? null,
          industry: (c.industry as string | null) ?? null,
          phase: (c.phase as string | null) ?? null,
          employee_count: (c.employee_count as number | null) ?? null,
          // ⚠️ 非公開企業には企業ページへのリンクを張らない（本番で404になるため）。
          //    timeline.ts:161 がこれを見て company_id を null に落とす。
          //    /u/[id] は以前から渡していたが、ここが漏れていた（2026-08-05 修正）。
          isPublished: (c.is_published as boolean) ?? false,
        });
      }
    }

    timelineCareers = buildTimelineCareerEntriesFromRaw(
      (expRows ?? []) as RawExperienceRow[],
      roleNameById,
      companyInfoById,
      true, // マイページは常にオーナー本人 → 実名表示
    );

    /* ── ここから下はプロフィール編集フォーム用の組み立て ────────────────────
          ⚠️ **追加のクエリを投げない。** 上の Promise.all で引いた行から作る。 */
    achievementsRaw = (achRows ?? []) as Record<string, unknown>[];
    awardsRaw = (awdRows ?? []) as Record<string, unknown>[];
    mediaAppearancesRaw = (medRows ?? []) as Record<string, unknown>[];
    contentLinksRaw = (linkRows ?? []) as Record<string, unknown>[];
    desiredRoleIds = ((desiredRoleRows ?? []) as { role_id: string }[]).map((r) => r.role_id);

    for (const r of (roleAliasRows ?? []) as { role_id: string; alias: string }[]) {
      if (!roleAliasMap[r.role_id]) roleAliasMap[r.role_id] = [];
      roleAliasMap[r.role_id].push(r.alias);
    }

    /* 編集フォームの職種候補。
       ⚠️ `is_active` で絞ったうえで、**本人が既に持っている職種は必ず足し戻す**
          （職歴の職種・希望職種の両方）。落とすとセレクトが空になり、
          別項目を直して保存した瞬間に職種が失われる。
       ⚠️ 親も一緒に足す。子だけ足しても親セレクトに親が無いと子セレクトが開かない。 */
    type RoleRow = { id: string; name: string; parent_id: string | null; display_order: number | null; is_active: boolean | null; is_it_saas: boolean | null };
    const allRoleRows = (allRoles ?? []) as RoleRow[];
    const byId = new Map(allRoleRows.map((r) => [r.id, r]));
    const keepIds = new Set(allRoleRows.filter((r) => r.is_active).map((r) => r.id));
    const ownRoleIds = [
      ...((expRows ?? []) as { role_category_id?: string | null }[]).map((e) => e.role_category_id),
      ...desiredRoleIds,
    ].filter((id): id is string => !!id);
    for (const id of ownRoleIds) {
      keepIds.add(id);
      const parent = byId.get(id)?.parent_id;
      if (parent) keepIds.add(parent);
    }
    editorRoles = allRoleRows
      .filter((r) => keepIds.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, parent_id: r.parent_id, display_order: r.display_order ?? 0 }))
      .sort((a, b) => a.display_order - b.display_order);

    /* 希望職種のピッカーは**母集団が違う**。IT/SaaS に絞る
       （絞らないと、企業側のフィルタから永久に辿り着けない職種を選べてしまう）。
       ⚠️ 既に選んでいるものと、その親は必ず残す。 */
    const keepForDesired = new Set<string>(desiredRoleIds);
    for (const id of desiredRoleIds) {
      const parent = byId.get(id)?.parent_id;
      if (parent) keepForDesired.add(parent);
    }
    desiredRoleOptions = editorRoles.filter(
      (r) => (byId.get(r.id)?.is_active && byId.get(r.id)?.is_it_saas) || keepForDesired.has(r.id)
    );

    /* 入社前後のギャップ（別テーブル）。**非公開データ**なので admin で引く。 */
    const gapsByExperience = new Map<string, { axis: string; rating: string }[]>();
    const expIds = (expRows ?? []).map((r) => (r as { id: string }).id);
    if (expIds.length > 0) {
      const { data: gapRows, error: gapErr } = await createAdminClient()
        .from("ow_experience_gaps")
        .select("experience_id, axis, rating")
        .in("experience_id", expIds);
      // ⚠️ 握り潰さない。空で描画すると、保存した瞬間に全消しになる
      if (gapErr) console.error("[mypage] ow_experience_gaps", gapErr.message);
      for (const g of gapRows ?? []) {
        const key = g.experience_id as string;
        if (!gapsByExperience.has(key)) gapsByExperience.set(key, []);
        gapsByExperience.get(key)!.push({ axis: g.axis as string, rating: g.rating as string });
      }
    }

    /* DB の行 → 編集フォームの Stint。
       ⚠️ 会社名は上の `companyInfoById`（タイムライン用に引いたもの）を使い回す。
          同じ ow_companies を2回引かない。 */
    initialExperiences = ((expRows ?? []) as Record<string, unknown>[]).map((r) => {
      let companyType: "master" | "custom" | "anon";
      let displayCompanyName: string;
      if (r.company_id) {
        companyType = "master";
        displayCompanyName = companyInfoById.get(r.company_id as string)?.name ?? "不明な企業";
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
        roleLabel: byId.get(roleUuid)?.name ?? roleUuid,
        roleTitle: (r.role_title as string | null) ?? undefined,
        startedAt: r.started_at ? (r.started_at as string).slice(0, 7) : "",
        endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
        isCurrent: r.is_current as boolean,
        description: (r.description as string | null) ?? undefined,
        joinReason: (r.join_reason as string | null) ?? undefined,
        employmentType: (r.employment_type as string | null) ?? undefined,
        /* ⚠️ department / rank は PUT が無条件に上書きするので、ここで拾わないと
              別の項目を直して保存しただけで消える。 */
        department: (r.department as string | null) ?? undefined,
        rank: (r.rank as Stint["rank"]) ?? null,
        /* ⚠️ 公開設定3列。DB は NOT NULL なので `?? 既定値` で埋めない。 */
        visibilityCompany: r.visibility_company as Stint["visibilityCompany"],
        visibilityCompanyProfile: r.visibility_company_profile as Stint["visibilityCompanyProfile"],
        visibilityReason: r.visibility_reason as boolean,
        prefecture: (r.prefecture as string | null) ?? undefined,
        remoteWorkStatus: (r.remote_work_status as string | null) ?? undefined,
        joinReasons: (r.join_reasons as string[] | null) ?? [],
        joinReasonPrimary: (r.join_reason_primary as string | null) ?? undefined,
        leaveReasons: (r.leave_reasons as string[] | null) ?? [],
        gaps: gapsByExperience.get(r.id as string) ?? [],
      };
    });
  }

  // 母校の同窓人数（自分除外・seed除外・private除外）
  const schoolPeerCounts: Record<string, number> = {};
  if (owUser) {
    const schoolIds = educations
      .filter((e) => e.school_id)
      .map((e) => e.school_id as string);
    if (schoolIds.length > 0) {
      const adminForSchools = createAdminClient();
      const { data: peerRows } = await adminForSchools
        .from("ow_user_educations")
        .select("school_id, ow_users!inner(visibility, is_test)")
        .in("school_id", schoolIds)
        .neq("user_id", owUser.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (peerRows ?? []) as Array<Record<string, any>>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = row.ow_users as Record<string, any> | null;
        if (!u) continue;
        if (u.visibility === "private") continue;
        if ((u.is_test as boolean | null) === true) continue;
        const sid = row.school_id as string;
        schoolPeerCounts[sid] = (schoolPeerCounts[sid] ?? 0) + 1;
      }
    }
  }

  /* ⚠️ ブックマークとカジュアル面談の取得を 2026-08-16 に削除した。
        右カラムの2枚（最近の申込・ブックマーク）と SPA ビューごと消えたので、
        **この画面では1件も使わない**。一覧は `/mypage/bookmarks`
        `/mypage/applications` が自分で引く。
        ⚠️ 消したのは ow_bookmarks / ow_companies×2 / ow_jobs×2 /
           ow_casual_meetings / fetchJobRoleLabels の**7本**。 */

  /* ow_profiles — 希望条件 + スカウト設定 + オンボーディング。
     ⚠️ `ow_profiles.user_id` は **auth.users.id**（ow_users.id ではない）。
     ⚠️ 希望職種の件数は上で引いた `desiredRoleIds` の長さから出す。**数え直さない。** */
  let showScoutBanner = false;
  let profilePrefs: {
    desired_work_styles: string[] | null;
    desired_prefectures: string[] | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    transfer_timing: string | null;
    desired_phase: string[] | null;
    worry: string | null;
    scout_enabled: boolean | null;
  } | null = null;
  if (owUser) {
    const { data: profile, error: profileError } = await supabase
      .from("ow_profiles")
      .select("desired_work_styles, desired_prefectures, desired_salary_min, desired_salary_max, transfer_timing, desired_phase, worry, onboarding_completed, scout_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) console.error("[mypage] ow_profiles fetch error:", profileError.message);
    // オンボーディング完了済みだが scout_enabled 未設定の場合バナー表示
    showScoutBanner = profile?.onboarding_completed === true && profile?.scout_enabled == null;
    if (profile) {
      profilePrefs = {
        desired_work_styles: profile.desired_work_styles ?? null,
        desired_prefectures: profile.desired_prefectures ?? null,
        desired_salary_min:  profile.desired_salary_min ?? null,
        desired_salary_max:  profile.desired_salary_max ?? null,
        transfer_timing:     profile.transfer_timing ?? null,
        desired_phase:       profile.desired_phase ?? null,
        worry:               profile.worry ?? null,
        scout_enabled:       profile.scout_enabled ?? null,
      };
    }
  }

  /* ⚠️ 実績・受賞・メディア・発信コンテンツの**件数はもう使わない**（2026-08-16）。
        完成度バーを外したため。行そのものは編集フォームが使うので取得は残す。 */

  // Fetch notification badge counts
  let conversationsBadge = 0;
  let applicationsBadge = 0;
  let scoutsBadge = 0;
  if (owUser) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: convCount }, { count: appCount }, { count: scoutCount }] = await Promise.all([
      supabase
        .from("ow_conversations")
        .select("id", { count: "exact", head: true })
        .or(`candidate_user_id.eq.${owUser.id},company_user_id.eq.${owUser.id}`)
        .gt("updated_at", sevenDaysAgo),
      supabase
        .from("ow_job_applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", owUser.id)
        .neq("status", "pending"),
      /* 未返答のスカウト。
         ⚠️ `ow_scouts.candidate_id` は **auth 空間**なので `user.id` で引く。
            `owUser.id`（ow_users 空間）で引くと常に0件になる。
         ⚠️ RLS の候補者ポリシーに依存しないよう admin で引く。条件は candidate_id だけ。 */
      createAdminClient()
        .from("ow_scouts")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", user.id)
        .eq("status", "sent"),
    ]);
    conversationsBadge = convCount ?? 0;
    applicationsBadge = appCount ?? 0;
    scoutsBadge = scoutCount ?? 0;
  }

  // Fetch ambassador memberships (面談対応者として登録されているか)
  type AmbassadorMembership = { id: string; company_id: string; company_name: string; role_title: string | null; display_consent: boolean };
  let ambassadorMemberships: AmbassadorMembership[] = [];
  if (owUser) {
    const adminSupabase = createAdminClient();
    const { data: memberRows } = await adminSupabase
      .from("ow_company_members")
      .select("id, company_id, role_title, display_consent, ow_companies!company_id(name, brand_name)")
      .eq("user_id", owUser.id);
    type MRow = { id: string; company_id: string; role_title: string | null; display_consent: boolean; ow_companies: { name: string | null; brand_name: string | null } | null };
    ambassadorMemberships = (memberRows ?? []).map((r) => {
      const row = r as unknown as MRow;
      return {
        id: row.id,
        company_id: row.company_id,
        company_name: row.ow_companies?.brand_name ?? row.ow_companies?.name ?? "—",
        role_title: row.role_title,
        display_consent: row.display_consent,
      };
    });
  }

  const isNewUser = searchParams?.welcome === "1";

  // 投稿できる人か。できないなら「アクティビティ」セクションごと畳む
  //（コンポーザーがセクションの中身そのものなので、消すと空欄になる）
  const canPost = owUser ? await canUserPost(createAdminClient(), owUser.id) : false;

  return (
    <MypageClient
      canPost={canPost}
      owUser={owUser}
      authEmail={user.email ?? ""}
      followCounts={followCounts}
      educations={educations}
      timelineCareers={timelineCareers}
      conversationsBadge={conversationsBadge}
      applicationsBadge={applicationsBadge}
      scoutsBadge={scoutsBadge}
      isNewUser={isNewUser}
      ambassadorMemberships={ambassadorMemberships}
      showScoutBanner={showScoutBanner}
      schoolPeerCounts={schoolPeerCounts}
      /* ── プロフィール編集フォーム（2026-08-16 に /profile/edit から移設）── */
      initialTab={searchParams?.tab}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEducations={educations as any}
      initialSocialLinks={(owUser?.social_links as Record<string, string> | null) ?? {}}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialAchievements={achievementsRaw as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialAwards={awardsRaw as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialMediaAppearances={mediaAppearancesRaw as any}
      initialExperiences={initialExperiences}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialContentLinks={contentLinksRaw as any}
      roles={editorRoles}
      roleAliases={roleAliasMap}
      initialScoutEnabled={profilePrefs?.scout_enabled ?? null}
      desiredRoleOptions={desiredRoleOptions}
      initialDesiredRoleIds={desiredRoleIds}
      initialProfilePrefs={profilePrefs}
    />
  );
}
