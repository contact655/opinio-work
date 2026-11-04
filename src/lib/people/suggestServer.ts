import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { PATHS_EXCLUDED_COMPANY_IDS } from "@/lib/constants/demoCompanies";
import { talkProfiles } from "@/lib/talk/server";
import { isSuggestDismissActive, pickUserSuggestions, type SuggestPerson } from "@/lib/people/suggest";

/**
 * ★ホームの「おすすめのユーザー」の材料を集めて、選び方（lib/people/suggest.ts）に渡す（2026-11-04）。
 *
 * 母集団: 本人が登録している（auth_id あり）・システムでない・公開範囲が private でない・名前がある人。
 *   テストかどうかを自分とそろえるのは選び方の側（pickUserSuggestions）。
 * ⚠️ 読むのは admin クライアント。返すのは名前・顔写真・理由の文だけ（職歴や会社の id は画面に渡さない）
 * ⚠️ 他人のフォロー関係は読まない（自分のフォローだけ）
 * ⚠️ ×で外した記録（ow_user_suggestion_dismissals）が読めないときは、外した人がいないものとして続ける（ログは出す）
 */

export type UserSuggestionView = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  gradient: string;
  initial: string;
  reason: string;
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

type ExpRow = {
  user_id: string; role_category_id: string | null; is_current: boolean | null; started_at: string | null; ended_at: string | null;
  company_id: string | null; visibility_company: string | null;
  ow_companies: { name: string | null; name_en: string | null; industry_id: string | null; is_test: boolean | null } | null;
};

const EXP_COLS = "user_id, role_category_id, is_current, started_at, ended_at, company_id, visibility_company, ow_companies!company_id(name, name_en, industry_id, is_test)" as const;

/** 現職（いちばん新しく始めた現職）、無ければいちばん新しく始めた職歴 */
function representative(rows: ExpRow[]): ExpRow | null {
  const sorted = [...rows].sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
  return sorted.find((e) => e.is_current === true) ?? sorted[0] ?? null;
}

export async function getUserSuggestions(viewer: { owUserId: string; isTest: boolean }, now: Date = new Date()): Promise<UserSuggestionView[]> {
  const db = createAdminClient();
  const [rolesRes, industriesRes, myExpRes, followsRes, companyFollowsRes, bookmarksRes, dismissRes, usersRes] = await Promise.all([
    db.from("ow_roles").select("id, parent_id, name"),
    db.from("ow_industries").select("id, parent_id, name"),
    db.from("ow_experiences").select(EXP_COLS).eq("user_id", viewer.owUserId),
    db.from("ow_user_follows").select("target_user_id").eq("follower_user_id", viewer.owUserId),
    db.from("ow_company_follows").select("company_id").eq("follower_user_id", viewer.owUserId),
    db.from("ow_bookmarks").select("target_id").eq("user_id", viewer.owUserId).eq("target_type", "job"),
    db.from("ow_user_suggestion_dismissals").select("target_user_id, dismissed_at").eq("viewer_user_id", viewer.owUserId),
    db.from("ow_users").select("id, name, avatar_url, avatar_color, is_test, updated_at")
      .not("auth_id", "is", null).eq("is_system", false).neq("visibility", "private").eq("is_test", viewer.isTest).neq("id", viewer.owUserId),
  ]);
  for (const [label, r] of [["roles", rolesRes], ["industries", industriesRes], ["my experiences", myExpRes], ["follows", followsRes], ["company follows", companyFollowsRes], ["bookmarks", bookmarksRes], ["users", usersRes]] as const) {
    if (r.error) {
      console.error(`[user suggestions] ${label}:`, r.error.message);
      return [];
    }
  }
  if (dismissRes.error) console.error("[user suggestions] dismissals:", dismissRes.error.message);

  const roles = (rolesRes.data ?? []) as { id: string; parent_id: string | null; name: string }[];
  const roleParent: Record<string, string | null> = Object.fromEntries(roles.map((r) => [r.id, r.parent_id]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const industries = (industriesRes.data ?? []) as { id: string; parent_id: string | null; name: string }[];
  const industryParent = new Map(industries.map((i) => [i.id, i.parent_id]));
  const industryName = new Map(industries.map((i) => [i.id, i.name]));
  const industryTop = (id: string | null | undefined) => (id ? (industryParent.get(id) ?? id) : null);
  const roleTopOf = (id: string) => { let cur = id; for (let i = 0; i < 5 && roleParent[cur]; i++) cur = roleParent[cur] as string; return cur; };

  /* 自分の職種と経歴 */
  const mine = representative((myExpRes.data ?? []) as unknown as ExpRow[]);
  const myRole = mine?.role_category_id ? { roleId: mine.role_category_id, label: roleName.get(mine.role_category_id) ?? "" } : null;
  const myIndTop = industryTop(mine?.ow_companies?.industry_id);
  const myStart = mine?.role_category_id && myIndTop
    ? { roleTopId: roleTopOf(mine.role_category_id), industryTopId: myIndTop, label: `${roleName.get(roleTopOf(mine.role_category_id)) ?? ""}×${industryName.get(myIndTop) ?? ""}` }
    : null;

  /* 保存した募集の会社 */
  const jobIds = ((bookmarksRes.data ?? []) as { target_id: string }[]).map((b) => b.target_id);
  let savedJobCompanyIds: string[] = [];
  if (jobIds.length > 0) {
    const { data: jobs, error } = await db.from("ow_jobs").select("company_id").in("id", jobIds);
    if (error) console.error("[user suggestions] jobs:", error.message);
    savedJobCompanyIds = ((jobs ?? []) as { company_id: string | null }[]).flatMap((j) => (j.company_id ? [j.company_id] : []));
  }

  const users = ((usersRes.data ?? []) as { id: string; name: string | null; avatar_url: string | null; avatar_color: string | null; is_test: boolean | null; updated_at: string | null }[])
    .filter((u) => !!u.name?.trim());
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];
  const [expRes, talk] = await Promise.all([
    db.from("ow_experiences").select(EXP_COLS).in("user_id", ids),
    talkProfiles(ids, now),
  ]);
  if (expRes.error) {
    console.error("[user suggestions] experiences:", expRes.error.message);
    return [];
  }
  const expsByUser = new Map<string, ExpRow[]>();
  for (const e of (expRes.data ?? []) as unknown as ExpRow[]) {
    const list = expsByUser.get(e.user_id) ?? [];
    list.push(e);
    expsByUser.set(e.user_id, list);
  }

  const people: SuggestPerson[] = users.map((u) => {
    const rows = expsByUser.get(u.id) ?? [];
    const rep = representative(rows);
    const shown = (e: ExpRow) => e.visibility_company === "real" && e.ow_companies?.is_test !== true;
    return {
      id: u.id,
      isTest: u.is_test === true,
      roleId: rep?.role_category_id ?? null,
      currentCompanies: rows.filter((e) => e.is_current === true && e.company_id).map((e) => ({
        companyId: e.company_id as string,
        nameIfShown: shown(e) && e.ow_companies?.name ? companyDisplayName(e.ow_companies.name, e.ow_companies.name_en).displayName : null,
      })),
      pastSteps: rows
        .filter((e) => e.ended_at && e.is_current !== true && shown(e) && !(e.company_id && PATHS_EXCLUDED_COMPANY_IDS.has(e.company_id)))
        .map((e) => ({ roleId: e.role_category_id, industryTopId: industryTop(e.ow_companies?.industry_id) })),
      atExcludedCompany: rows.some((e) => e.is_current === true && !!e.company_id && PATHS_EXCLUDED_COMPANY_IDS.has(e.company_id)),
      talkOpen: talk?.get(u.id)?.open === true,
      updatedAt: u.updated_at,
    };
  });

  const dismissed = ((dismissRes.data ?? []) as { target_user_id: string; dismissed_at: string }[])
    .filter((d) => isSuggestDismissActive(d.dismissed_at, now)).map((d) => d.target_user_id);

  const picked = pickUserSuggestions({
    viewerId: viewer.owUserId,
    viewerIsTest: viewer.isTest,
    myRole,
    myStart,
    roleParent,
    followedUserIds: ((followsRes.data ?? []) as { target_user_id: string }[]).map((f) => f.target_user_id),
    followedCompanyIds: ((companyFollowsRes.data ?? []) as { company_id: string }[]).map((f) => f.company_id),
    savedJobCompanyIds,
    dismissedUserIds: dismissed,
    people,
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return picked.map((p) => {
    const u = byId.get(p.userId)!;
    const name = (u.name ?? "").trim();
    return {
      userId: u.id,
      name,
      avatarUrl: u.avatar_url,
      gradient: typeof u.avatar_color === "string" && u.avatar_color.startsWith("linear-gradient") ? u.avatar_color : FALLBACK_GRADIENT,
      initial: name.charAt(0),
      reason: p.reason,
    };
  });
}
