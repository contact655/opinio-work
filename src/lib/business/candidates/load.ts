/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcTotalExperience } from "@/lib/profile/tenure";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS, MASKED_COMPANY_LABEL } from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";
import { getDesiredRolesFor } from "@/lib/profile/desiredRoles";
import { resolveTopRole } from "@/lib/roles/jobRoles";
/* ★「できること」（職種 × 年数）。⚠️★**職種だけの版を使う**——事業領域は
      `company_id` から引くので、社名を伏せた職歴から企業側へ漏れる（関数の注記）。 */
import { buildRoleAutoSkills } from "@/lib/profile/autoSkillsServer";
import { canUse, type PlanType } from "@/lib/constants/plans";
import { getRecentlyApproached, listApproachableJobs, type RecentApproach } from "@/lib/approaches/server";
import { isCandidateNotesEnabled, listCandidateStages } from "@/lib/candidateNotes/server";
import { getCompanyCandidateTouchpoints, type TouchpointMaterials } from "@/lib/business/candidates/touchpoints";
import type { Candidate } from "@/lib/business/candidates/model";

/**
 * ★候補者検索の母集団と、候補者1人ぶんの形を組む（2026-10-10 / 候補者探し 段1 でページから切り出した）。
 *
 * ⚠️★**画面（/biz/candidates）と、保存した条件の新着を数える処理（段3）が同じ関数を呼ぶ。**
 *    絞り込みは `lib/business/candidates/model.ts` の `filterCandidates`。
 * ⚠️★見せてよいか（`can_send_scout()`）と声かけを送れるか（`can_send_company_approach()`）は
 *    DB 関数の**まとめて呼ぶ入口**（`*_many`。中身は元の関数を各行で呼ぶだけ）を通す。
 *    ここで条件を組み立てないこと。
 * ⚠️ 取得に失敗した部分は fail-closed（見せない／ボタンを出さない）。
 */
export type LoadedCandidates = {
  candidates: Candidate[];
  roleFilterTree: { id: string; name: string; children: { id: string; name: string }[] }[];
  approachJobs: { id: string; title: string }[];
  /** 接点の材料が自社に揃っているか。null = 取れなかった */
  touchpointMaterials: TouchpointMaterials | null;
};

export async function loadCompanyCandidates(params: {
  companyId: string;
  /** 見ている担当者（声かけの送り手。is_test の一致は DB 関数が見る） */
  viewerOwUserId: string;
  planType: PlanType | null;
  /** 1人ぶんだけ欲しいとき（右のプレビュー）。⚠️ 判定は一覧と同じ経路を通る */
  onlyOwUserId?: string;
}): Promise<LoadedCandidates> {
  const adminClient = createAdminClient();
  const { companyId } = params;

  const [profileRows, blockedPlacements, companyRow] = await Promise.all([
    adminClient
      .from("ow_profiles")
      /* ⚠️★`desired_phase` / `transfer_timing` は引かない（本人側の入力欄を 2026-08-27 に消した）。
         ★`career_stance_updated_at` を使う（`stance_updated_at` は面談OK の操作でも動く）。 */
      .select("user_id, onboarding_completed, desired_work_styles, desired_prefectures, desired_salary_min, desired_salary_max, career_stance, career_stance_updated_at")
      /* ⚠️★未設定（null）と no_contact は入れない。`can_send_scout()` と**同じ条件**。片方だけ変えないこと */
      .not("career_stance", "is", null)
      .neq("career_stance", "no_contact")
      .then((r) => { if (r.error) console.error("[candidates] ow_profiles:", r.error.message); return r.data ?? []; }),
    /* 転職勧奨禁止（就職後2年以内かつ在職中）。⚠️ candidate_id は auth 空間 */
    adminClient
      .from("ow_placements")
      .select("candidate_id")
      .is("resigned_at", null)
      .gte("joined_at", new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .then((r) => { if (r.error) console.error("[candidates] ow_placements:", r.error.message); return r.data ?? []; }),
    adminClient.from("ow_companies").select("is_test").eq("id", companyId).maybeSingle(),
  ]);
  const companyIsTest = companyRow.data?.is_test === true;
  const blockedCandidateIds = new Set(blockedPlacements.map((p) => p.candidate_id as string));
  const stanceAuthIds = profileRows.map((p) => p.user_id as string);

  /* ow_users。⚠️ `birth_date` は取らない（年齢で絞り込ませない。労働施策総合推進法9条）。
     ⚠️★`is_test` はここで絞らない。判定は `can_send_scout()` の1箇所（見る企業と is_test が一致する人だけ） */
  let usersQ = adminClient
    .from("ow_users")
    .select("id, name, headline, location, created_at, auth_id, is_test, profile_edited_at")
    .in("auth_id", stanceAuthIds.length ? stanceAuthIds : ["00000000-0000-0000-0000-000000000000"])
    .neq("visibility", "private")
    .not("is_system", "eq", true)
    .order("created_at", { ascending: false })
    .limit(500);
  if (params.onlyOwUserId) usersQ = usersQ.eq("id", params.onlyOwUserId);
  const { data: rawUsers, error: rawUsersError } = await usersQ;
  if (rawUsersError) console.error("[candidates] ow_users:", rawUsersError.message);

  const profilesByAuthId = new Map(profileRows.map((p) => [p.user_id as string, p]));
  const eligibleUsers = (rawUsers ?? []).filter((u) => u.auth_id && !blockedCandidateIds.has(u.auth_id as string));

  /* ★見せてよいか。まとめて1本（2026-10-10）。⚠️ 失敗したら誰も見せない（fail-closed） */
  const visibleAuth = new Set<string>();
  if (eligibleUsers.length) {
    const { data, error } = await adminClient.rpc("can_send_scout_many", {
      p_company_id: companyId,
      p_candidate_ids: eligibleUsers.map((u) => u.auth_id as string),
    });
    if (error) console.error("[candidates] can_send_scout_many:", error.message);
    for (const r of (data ?? []) as { candidate_id: string; ok: boolean }[]) if (r.ok === true) visibleAuth.add(r.candidate_id);
  }
  const users = eligibleUsers.filter((u) => visibleAuth.has(u.auth_id as string));
  const userIds = users.map((u) => u.id as string);

  /* 現職。⚠️ error を捨てない（埋め込みが PGRST201 になって社名が全員空になった前例） */
  const [{ data: currentExps, error: currentExpsErr }, { data: allExps, error: allExpErr }] = await Promise.all([
    userIds.length
      ? adminClient.from("ow_experiences")
          .select(`user_id, role_title, role_category_id, employment_type, started_at, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
          .in("user_id", userIds).eq("is_current", true)
      : Promise.resolve({ data: [], error: null }),
    /* 社会人年数と「できること」の材料。⚠️★`company_id` は取らない（伏せた職歴の事業領域が漏れる） */
    userIds.length
      ? adminClient.from("ow_experiences").select("user_id, started_at, ended_at, role_category_id").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (currentExpsErr) console.error("[candidates] ow_experiences:", currentExpsErr.message);
  if (allExpErr) console.error("[candidates] ow_experiences(all):", allExpErr.message);

  const startedAtsByUser = new Map<string, string[]>();
  const expRowsByUser = new Map<string, { started_at: string | null; ended_at: string | null; role_category_id: string | null }[]>();
  for (const e of (allExps ?? []) as { user_id: string; started_at: string | null; ended_at: string | null; role_category_id: string | null }[]) {
    if (!expRowsByUser.has(e.user_id)) expRowsByUser.set(e.user_id, []);
    expRowsByUser.get(e.user_id)!.push(e);
    if (!e.started_at) continue;
    if (!startedAtsByUser.has(e.user_id)) startedAtsByUser.set(e.user_id, []);
    startedAtsByUser.get(e.user_id)!.push(e.started_at);
  }

  const currentExpByUser = new Map<string, { role_title: string | null; role_category_id: string | null; company: string | null; employment_type: string | null; started_at: string | null }>();
  for (const exp of (currentExps ?? []) as Record<string, unknown>[]) {
    const uid = exp.user_id as string;
    if (currentExpByUser.has(uid)) continue;
    /* ★★本人が社名を伏せている行は社名を出さない（2026-09-10）。⚠️ RLS を通らない経路なので条件を書かないと全件が実名で出る。
       ⚠️ 空欄にしない（離職中・未入力に見える）。表示と絞り込みの両方がこの値を読むので、ここで置き換えれば両方塞がる */
    const vis = (exp.visibility_company as string | null) ?? "real";
    currentExpByUser.set(uid, {
      role_title: (exp.role_title as string | null) ?? null,
      role_category_id: (exp.role_category_id as string | null) ?? null,
      company: vis === "real" ? resolveExperienceCompanyName(exp as Parameters<typeof resolveExperienceCompanyName>[0]) : MASKED_COMPANY_LABEL,
      employment_type: (exp.employment_type as string | null) ?? null,
      started_at: (exp.started_at as string | null) ?? null,
    });
  }

  const roleTree = await getRoleTree();
  const roleInfoById = new Map<string, { name: string; parent_name: string | null }>();
  roleTree.byId.forEach((node, id) => {
    const parent = node.parentId ? roleTree.byId.get(node.parentId) : undefined;
    roleInfoById.set(id, { name: node.name, parent_name: parent?.name ?? null });
  });
  const desiredByAuthId = await getDesiredRolesFor(users.map((u) => u.auth_id as string));

  /* ★声かけ。判定は DB 関数（まとめて呼ぶ入口）。⚠️ 失敗したら null → ボタンを出さない */
  const approachAllowed = canUse(params.planType, "companyApproach");
  let approachOk: Map<string, boolean> | null = null;
  if (approachAllowed) {
    if (userIds.length === 0) approachOk = new Map();
    else {
      const { data, error } = await adminClient.rpc("can_send_company_approach_many", {
        p_company_id: companyId,
        p_candidate_ow_user_ids: userIds,
        p_sender_ow_user_id: params.viewerOwUserId,
      });
      if (error) console.error("[candidates] can_send_company_approach_many:", error.message);
      else approachOk = new Map(((data ?? []) as { candidate_ow_user_id: string; ok: boolean }[]).map((r) => [r.candidate_ow_user_id, r.ok === true]));
    }
  }
  const [approachJobs, recentlyApproached, stages, touch] = await Promise.all([
    approachAllowed ? listApproachableJobs(companyId) : Promise.resolve([] as { id: string; title: string }[]),
    approachAllowed ? getRecentlyApproached(companyId, userIds) : Promise.resolve(new Map<string, RecentApproach>()),
    isCandidateNotesEnabled() ? listCandidateStages(companyId, userIds) : Promise.resolve(null),
    getCompanyCandidateTouchpoints(companyId, companyIsTest, users.map((u) => ({
      owUserId: u.id as string,
      isTest: u.is_test === true,
      location: (u.location as string | null) ?? null,
      desiredRoleIds: desiredByAuthId.get(u.auth_id as string)?.ids ?? [],
    }))),
  ]);

  const candidates: Candidate[] = users.map((u) => {
    const authId = u.auth_id as string;
    const profile = profilesByAuthId.get(authId) ?? null;
    const currentExp = currentExpByUser.get(u.id as string) ?? null;
    return {
      id: u.id as string,
      name: (u.name as string) || "名前未設定",
      headline: ((u.headline as string | null) ?? "").trim() || null,
      location: (u.location as string) || null,
      /* 「転職検討中」バッジは `active` だけ */
      isActivelyLooking: profile?.career_stance === "active",
      careerStance: (profile?.career_stance as string | null) ?? null,
      careerStanceUpdatedAt: (profile?.career_stance_updated_at as string | null) ?? null,
      /* ⚠️ 職歴0件は null（0年で埋めない） */
      tenureMonths: calcTotalExperience(startedAtsByUser.get(u.id as string) ?? [])?.months ?? null,
      currentRole: currentExp?.role_title ?? null,
      currentCompany: currentExp?.company ?? null,
      employmentType: currentExp?.employment_type ?? null,
      startedAt: currentExp?.started_at ?? null,
      roleName: currentExp?.role_category_id ? roleTree.byId.get(currentExp.role_category_id)?.name ?? null : null,
      topRoleName: resolveTopRole(roleTree, currentExp?.role_category_id)?.name ?? null,
      /* ⚠️ 絞り込みは expandedIds（職種＋祖先）、表示は names（選ばれたものだけ） */
      desiredRoleIds: desiredByAuthId.get(authId)?.expandedIds ?? [],
      desiredRoleNames: desiredByAuthId.get(authId)?.names ?? [],
      workStyles: (profile?.desired_work_styles as string[] | null) || null,
      desiredPrefectures: (profile?.desired_prefectures as string[] | null) || null,
      desiredSalaryMin: (profile?.desired_salary_min as number | null) ?? null,
      desiredSalaryMax: (profile?.desired_salary_max as number | null) ?? null,
      onboardingCompleted: profile?.onboarding_completed === true,
      createdAt: u.created_at as string,
      profileEditedAt: (u.profile_edited_at as string | null) ?? null,
      autoSkills: buildRoleAutoSkills(expRowsByUser.get(u.id as string) ?? [], roleInfoById)
        .slice(0, 4).map((sk) => ({ label: sk.label, band: sk.band })),
      approach: approachAllowed && recentlyApproached && approachOk
        ? { eligible: approachOk.get(u.id as string) === true, sent: recentlyApproached.get(u.id as string) ?? null }
        : undefined,
      stage: stages ? (stages.get(u.id as string) ?? null) : undefined,
      touchpoints: touch ? (touch.byCandidate.get(u.id as string) ?? []) : undefined,
    };
  });

  /* 職種フィルタ用の階層。⚠️ is_it_saas = true の大分類だけ（非IT は過去の職歴を書くための葉） */
  const { data: itSaasTopRows } = await adminClient
    .from("ow_roles").select("id").is("parent_id", null).eq("is_active", true).eq("is_it_saas", true);
  const itSaasTopIds = new Set((itSaasTopRows ?? []).map((r) => r.id as string));
  const roleFilterTree = roleTree.topLevel
    .filter((top) => itSaasTopIds.has(top.id))
    .map((top) => ({
      id: top.id,
      name: top.name,
      children: Array.from(roleTree.byId.values())
        .filter((r) => r.parentId === top.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((r) => ({ id: r.id, name: r.name })),
    }));

  return { candidates, roleFilterTree, approachJobs, touchpointMaterials: touch?.materials ?? null };
}
