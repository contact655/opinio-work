/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows, inChunks } from "@/lib/supabase/paging";
import { calcTotalExperience } from "@/lib/profile/tenure";
import { getUserAge } from "@/lib/age";
import { isCandidateAgeDisplayEnabled } from "@/lib/business/candidates/ageFilter";
import { candidateGenderLabel, isCandidateGenderDisplayEnabled } from "@/lib/business/candidates/genderDisplay";
import { activityBand, isCandidateActivityEnabled } from "@/lib/business/candidates/activity";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS, MASKED_COMPANY_LABEL } from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";
import { getDesiredRolesFor } from "@/lib/profile/desiredRoles";
import { resolveTopRole } from "@/lib/roles/jobRoles";
/* ★「できること」（職種 × 年数）。⚠️★**職種だけの版を使う**——事業領域は
      `company_id` から引くので、社名を伏せた職歴から企業側へ漏れる（関数の注記）。 */
import { buildRoleAutoSkills } from "@/lib/profile/autoSkillsServer";
import { canUse, type PlanType } from "@/lib/constants/plans";
import { getRecentlyApproached, listApproachableJobs, unseenRepliedConversationIds, type RecentApproach } from "@/lib/approaches/server";
import { unreadMessageCounts } from "@/lib/conversations/unread";
import { isCandidateNotesEnabled, listCandidateNoteCounts, listCandidateStages } from "@/lib/candidateNotes/server";
import { getCompanyCandidateTouchpoints, type TouchpointMaterials } from "@/lib/business/candidates/touchpoints";
import { getCompanyPositionFits } from "@/lib/business/candidates/positionFit";
import type { PositionFits, PositionOption } from "@/lib/business/candidates/positionFitModel";
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
/** ★候補者を取る上限（登録の新しい順）。⚠️ 達したら画面に「最新の500名を表示しています」と出す（2026-10-13） */
export const CANDIDATE_LOAD_LIMIT = 500;

export type LoadedCandidates = {
  candidates: Candidate[];
  /** ★取得件数が上限（CANDIDATE_LOAD_LIMIT）に達したか。⚠️ 達していれば古い登録の人が一覧に出ていない */
  limitReached: boolean;
  roleFilterTree: { id: string; name: string; children: { id: string; name: string }[] }[];
  approachJobs: { id: string; title: string }[];
  /** 接点の材料が自社に揃っているか。null = 取れなかった */
  touchpointMaterials: TouchpointMaterials | null;
  /** ★ポジションで見る（2026-10-18）。自社の求人（下書きも含む）と、求人ごとの合うところ。null = 取れなかった */
  positions: PositionOption[] | null;
  positionFits: PositionFits;
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
    /* ★1,000 行ずつ最後まで引く（2026-10-19。超えたぶんが黙って消え、母集団が欠けていた） */
    fetchAllRows((from, to) => adminClient
      .from("ow_profiles")
      /* ⚠️★`desired_phase` / `transfer_timing` は引かない（本人側の入力欄を 2026-08-27 に消した）。
         ★`career_stance_updated_at` を使う（`stance_updated_at` は面談OK の操作でも動く）。 */
      .select("user_id, onboarding_completed, desired_work_styles, desired_prefectures, desired_salary_min, desired_salary_max, career_stance, career_stance_updated_at")
      /* ⚠️★未設定（null）と no_contact は入れない。`can_send_scout()` と**同じ条件**。片方だけ変えないこと */
      .not("career_stance", "is", null)
      .neq("career_stance", "no_contact")
      .order("user_id")
      .range(from, to), "candidates profiles")
      .then((r) => { if (r.error) console.error("[candidates] ow_profiles:", r.error); return r.data; }),
    /* 転職勧奨禁止（就職後2年以内かつ在職中）。⚠️ candidate_id は auth 空間 */
    fetchAllRows((from, to) => adminClient
      .from("ow_placements")
      .select("candidate_id")
      .is("resigned_at", null)
      .gte("joined_at", new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("candidate_id")
      .range(from, to), "candidates placements")
      .then((r) => { if (r.error) console.error("[candidates] ow_placements:", r.error); return r.data; }),
    adminClient.from("ow_companies").select("is_test").eq("id", companyId).maybeSingle(),
  ]);
  const companyIsTest = companyRow.data?.is_test === true;
  /* ★見ている担当者が検証用か（送れない理由の「検証用の会社のため…」に使う。2026-10-11）。⚠️ 取れなければ null（理由を出さず「その他」） */
  const { data: viewerRow, error: viewerErr } = await adminClient.from("ow_users").select("is_test").eq("id", params.viewerOwUserId).maybeSingle();
  if (viewerErr) console.error("[candidates] viewer:", viewerErr.message);
  const viewerIsTest: boolean | null = viewerRow ? viewerRow.is_test === true : null;
  const blockedCandidateIds = new Set(blockedPlacements.map((p) => p.candidate_id as string));
  const stanceAuthIds = profileRows.map((p) => p.user_id as string);

  /* ow_users。★`birth_date` は 2026-10-12 から読む（柴さんの判断で年齢を一覧と右欄に出すため）。
        ⚠️★**読むのはこのサーバーの関数の中だけ。** 下で `getUserAge()` を通して年齢（数）にし、
           生年月日そのものは Candidate に入れない（＝ブラウザに渡さない）。admin クライアントで読む
           （authenticated には birth_date の SELECT を配っていない。開けると全員分が取れる）。
     ⚠️★`is_test` はここで絞らない。判定は `can_send_scout()` の1箇所（見る企業と is_test が一致する人だけ） */
  /* ★年齢の表示が無効（本番）なら birth_date を読まない（2026-10-12）。数もページに渡さない */
  const ageDisplay = isCandidateAgeDisplayEnabled();
  /* ★最近の利用（2026-10-12）。⚠️ 無効（本番）なら last_active_at を読まない。有効でも帯だけを返す（正確な日時は Candidate に入れない） */
  const activityOn = isCandidateActivityEnabled();
  /* ★性別（2026-10-12）。⚠️ 無効（本番）なら gender を読まない。有効でも表示用の文字だけを Candidate に入れる（絞り込みには使わない） */
  const genderDisplay = isCandidateGenderDisplayEnabled();
  const userCols = ["id, name, headline, avatar_url, location, created_at, auth_id, is_test, profile_edited_at", ageDisplay ? "birth_date" : null, activityOn ? "last_active_at" : null, genderDisplay ? "gender" : null].filter(Boolean).join(", ");
  /* ★auth_id は分けて引き、新しい順に並べ直してから上限で切る（2026-10-19。何百もの id を1回で渡すと URL が長すぎて失敗する） */
  const usersBase = () => adminClient
    .from("ow_users")
    /* ⚠️ 型は列が多いほうに合わせる（無効のときは birth_date が返らず、下で読まない） */
    .select(userCols as "id, name, headline, avatar_url, location, created_at, auth_id, is_test, profile_edited_at, birth_date, last_active_at, gender")
    .neq("visibility", "private")
    .not("is_system", "eq", true);
  /* ⚠️ 1人ぶん（右のプレビュー）は id で1回だけ引き、転職意欲の条件（stanceAuthIds）で絞る */
  const stanceSet = new Set(stanceAuthIds);
  const usersRes = params.onlyOwUserId
    ? await usersBase().eq("id", params.onlyOwUserId).then((r) => ({
        data: (r.data ?? []).filter((u) => stanceSet.has(u.auth_id as string)),
        error: r.error ? r.error.message : null,
      }))
    : await inChunks(stanceAuthIds, (part, from, to) =>
        usersBase().in("auth_id", part).order("created_at", { ascending: false }).order("id").range(from, to), "candidates users");
  if (usersRes.error) console.error("[candidates] ow_users:", usersRes.error);
  const rawUsers = [...usersRes.data]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, CANDIDATE_LOAD_LIMIT);

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
    /* ★id を分けて、1,000 行ずつ最後まで引く（2026-10-19） */
    inChunks(userIds, (part, from, to) => adminClient.from("ow_experiences")
      .select(`id, user_id, role_title, role_category_id, employment_type, started_at, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .in("user_id", part).eq("is_current", true).order("id").range(from, to), "candidates current exps"),
    /* 社会人年数と「できること」の材料。⚠️★`company_id` は取らない（伏せた職歴の事業領域が漏れる） */
    inChunks(userIds, (part, from, to) => adminClient.from("ow_experiences").select("id, user_id, started_at, ended_at, role_category_id").in("user_id", part).order("id").range(from, to), "candidates all exps"),
  ]);
  if (currentExpsErr) console.error("[candidates] ow_experiences:", currentExpsErr);
  if (allExpErr) console.error("[candidates] ow_experiences(all):", allExpErr);

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
  const [approachJobs, recentlyApproached, stages, touch, noteCounts, positionFit] = await Promise.all([
    approachAllowed ? listApproachableJobs(companyId) : Promise.resolve([] as { id: string; title: string }[]),
    approachAllowed ? getRecentlyApproached(companyId, userIds) : Promise.resolve(new Map<string, RecentApproach>()),
    isCandidateNotesEnabled() ? listCandidateStages(companyId, userIds) : Promise.resolve(null),
    getCompanyCandidateTouchpoints(companyId, companyIsTest, users.map((u) => ({
      owUserId: u.id as string,
      isTest: u.is_test === true,
      location: (u.location as string | null) ?? null,
      desiredRoleIds: desiredByAuthId.get(u.auth_id as string)?.ids ?? [],
    }))),
    /* ★社内メモの件数（カードの「社内メモ 〇」。2026-10-11）。⚠️ フラグがオフなら引かない */
    isCandidateNotesEnabled() ? listCandidateNoteCounts(companyId, userIds) : Promise.resolve(null),
    /* ★ポジションで見る（2026-10-18）。⚠️ 突き合わせは positionFit.ts の1か所 */
    getCompanyPositionFits(companyId, companyIsTest, users.map((u) => ({
      owUserId: u.id as string,
      location: (u.location as string | null) ?? null,
      desiredRoleIds: desiredByAuthId.get(u.auth_id as string)?.ids ?? [],
      desiredPrefectures: (profilesByAuthId.get(u.auth_id as string)?.desired_prefectures as string[] | null) ?? null,
    }))),
  ]);

  /* ★★（気になる。2026-10-12）と見送り（2026-10-13）。この会社の分だけ。⚠️ 取れなければ全員 false（ログは出す）。
        ★未読（2026-10-13）。メッセージを送った人がいるときだけ、一覧の分を**まとめて1回**取る（1人ずつ取らない）。
        ⚠️ 見ている担当者の未読（`unreadMessageCounts`）と、自社の誰も開いていない返信（`unseenRepliedConversationIds`）。
           右欄のタブ「メッセージ（n）」と一覧の「返信あり」が同じ値を見る */
  const starred = new Set<string>();
  const hiddenIds = new Set<string>();
  const hasConversation = Array.from(recentlyApproached?.values() ?? []).some((a) => !!a.conversationId);
  const [starsR, hiddenR, unreadCounts, unseenConvs] = await Promise.all([
    inChunks(userIds, (part, from, to) => adminClient.from("ow_candidate_stars").select("candidate_user_id").eq("company_id", companyId).in("candidate_user_id", part).order("candidate_user_id").range(from, to), "candidates stars"),
    inChunks(userIds, (part, from, to) => adminClient.from("ow_candidate_hidden").select("candidate_user_id, hidden_by, created_at").eq("company_id", companyId).in("candidate_user_id", part).order("candidate_user_id").range(from, to), "candidates hidden"),
    approachAllowed && hasConversation ? unreadMessageCounts(params.viewerOwUserId, { companyId }) : Promise.resolve(new Map<string, number>()),
    approachAllowed && hasConversation ? unseenRepliedConversationIds(companyId) : Promise.resolve(new Set<string>()),
  ]);
  if (starsR.error) console.error("[candidates] ow_candidate_stars:", starsR.error);
  if (hiddenR.error) console.error("[candidates] ow_candidate_hidden:", hiddenR.error);
  for (const r of starsR.data ?? []) starred.add(r.candidate_user_id as string);
  for (const r of hiddenR.data ?? []) hiddenIds.add(r.candidate_user_id as string);
  /* ★誰がいつ見送ったか（2026-10-13）。見送った担当者の名前はまとめて1回。⚠️ 取れなければ名前なし（「見送り・日付」） */
  const hiddenInfo = new Map<string, { name: string | null; at: string }>();
  const hiderIds = Array.from(new Set((hiddenR.data ?? []).map((r) => r.hidden_by as string | null).filter((v): v is string => !!v)));
  const hiderNames = new Map<string, string>();
  if (hiderIds.length) {
    const { data: hs, error: hsErr } = await inChunks(hiderIds, (part, from, to) => adminClient.from("ow_users").select("id, name").in("id", part).order("id").range(from, to), "candidates hiders");
    if (hsErr) console.error("[candidates] hidden_by names:", hsErr);
    for (const h of hs ?? []) hiderNames.set(h.id as string, ((h.name as string | null) ?? "").trim());
  }
  for (const r of hiddenR.data ?? []) {
    hiddenInfo.set(r.candidate_user_id as string, { name: (r.hidden_by && hiderNames.get(r.hidden_by as string)) || null, at: r.created_at as string });
  }

  const candidates: Candidate[] = users.map((u) => {
    const authId = u.auth_id as string;
    const profile = profilesByAuthId.get(authId) ?? null;
    const currentExp = currentExpByUser.get(u.id as string) ?? null;
    return {
      id: u.id as string,
      name: (u.name as string) || "名前未設定",
      headline: ((u.headline as string | null) ?? "").trim() || null,
      avatarUrl: (u.avatar_url as string | null) ?? null,
      location: (u.location as string) || null,
      /* 「転職検討中」バッジは `active` だけ */
      isActivelyLooking: profile?.career_stance === "active",
      careerStance: (profile?.career_stance as string | null) ?? null,
      careerStanceUpdatedAt: (profile?.career_stance_updated_at as string | null) ?? null,
      /* ⚠️ 職歴0件は null（0年で埋めない） */
      tenureMonths: calcTotalExperience(startedAtsByUser.get(u.id as string) ?? [])?.months ?? null,
      /* ★年齢（数だけ）。⚠️ 生年月日が無ければ null（推測しない）。birth_date そのものは返さない */
      age: ageDisplay ? getUserAge((u.birth_date as string | null) ?? null) : null,
      /* ★性別の表示用の文字だけ（男性・女性・その他）。「回答しない」・未登録は null。⚠️ 値は渡さない（絞り込みに使わせない） */
      genderLabel: genderDisplay ? candidateGenderLabel((u.gender as string | null) ?? null) : null,
      /* ★帯だけ（undefined = スイッチが無効。画面は何も出さない） */
      activity: activityOn ? activityBand((u.last_active_at as string | null) ?? null) : undefined,
      currentRole: currentExp?.role_title ?? null,
      currentCompany: currentExp?.company ?? null,
      employmentType: currentExp?.employment_type ?? null,
      startedAt: currentExp?.started_at ?? null,
      roleName: currentExp?.role_category_id ? roleTree.byId.get(currentExp.role_category_id)?.name ?? null : null,
      topRoleName: resolveTopRole(roleTree, currentExp?.role_category_id)?.name ?? null,
      /* ⚠️ 絞り込みは expandedIds（職種＋祖先）、表示は names（選ばれたものだけ） */
      desiredRoleIds: desiredByAuthId.get(authId)?.expandedIds ?? [],
      /* ★経験職種（2026-10-13）。既にある職歴の取得（allExps）から作る（クエリを増やさない）。親まで展開する */
      expRoleIds: (() => {
        const ids = new Set<string>();
        for (const e of expRowsByUser.get(u.id as string) ?? []) {
          if (!e.role_category_id) continue;
          ids.add(e.role_category_id);
          const parent = roleTree.byId.get(e.role_category_id)?.parentId;
          if (parent) ids.add(parent);
        }
        return Array.from(ids);
      })(),
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
        ? (() => {
            const eligible = approachOk.get(u.id as string) === true;
            const sent = recentlyApproached.get(u.id as string) ?? null;
            /* ★送れない理由（2026-10-11）。⚠️ 検証用の会社を実アカウントで見ているときだけ test_company
                  （実在の会社の候補者は実在の人だけなので、実在の会社では出ない）。範囲外・受け取らない企業は区別しない */
            const blocked = eligible || sent ? undefined
              : companyIsTest && viewerIsTest === false ? "test_company" as const
              : profile?.career_stance === "no_contact" ? "not_looking" as const
              : "other" as const;
            const conv = sent?.conversationId ?? null;
            return {
              eligible, sent, ...(blocked ? { blocked } : {}),
              unreadCount: conv ? unreadCounts.get(conv) ?? 0 : 0,
              unseenReply: conv ? unseenConvs.has(conv) : false,
            };
          })()
        : undefined,
      stage: stages ? (stages.get(u.id as string) ?? null) : undefined,
      noteCount: noteCounts ? (noteCounts.get(u.id as string) ?? 0) : undefined,
      touchpoints: touch ? (touch.byCandidate.get(u.id as string) ?? []) : undefined,
      starred: starred.has(u.id as string),
      hidden: hiddenIds.has(u.id as string),
      hiddenBy: hiddenInfo.get(u.id as string) ?? null,
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

  return { candidates, limitReached: (rawUsers ?? []).length >= CANDIDATE_LOAD_LIMIT, roleFilterTree, approachJobs, touchpointMaterials: touch?.materials ?? null,
    positions: positionFit?.positions ?? null, positionFits: positionFit?.fits ?? {} };
}
