import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyEmployeesCached } from "@/lib/supabase/queries";
import { pickConnections } from "@/lib/companies/connectionsPick";
import { isRegisteredUser } from "@/lib/users/registered";

/**
 * ★企業ページの「この会社に、あなたのつながりがいます」（2026-10-16 / フェーズ3）。
 *
 * つながり＝**閲覧者と相互フォロー**（`ow_user_follows` が両向きにある）で、
 * **その会社に is_current の職歴がある**人。友達リクエスト（申請・承認）は作らない。
 *
 * 母集団は企業ページの現役社員（`getCompanyEmployeesCached(...).current`）をそのまま使う。
 * ＝ 除外の条件は `getCompanyEmployees` の `isSeedRow` と同じ
 *   （検証用・`visibility = 'private'`・本人が登録していない行）＋ 企業が非表示にした職歴
 *   ＋ `visibility_company = 'hidden'`。⚠️★**条件をここに書き写さないこと。**
 *
 * ⚠️★表示されるのは、**本人が `ow_profiles.show_as_connection = true` にした人だけ**（初期値 false）。
 *    `ow_profiles.user_id` は **auth 空間**なので `ow_users.auth_id` で結合する。
 * ⚠️ 失敗したら null（0人と区別する。0人に倒すと壊れているのに消える）。
 */

export type CompanyConnection = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarInitial: string;
  avatarGradient: string;
};

export async function getCompanyConnections(
  companyId: string,
  viewerOwUserId: string,
  /**
   * ★見ている人が検証用アカウントか（2026-10-21 / 柴さんの判断）。
   *   true なら候補は**検証用の人だけ**（その会社に在籍中の検証用アカウント）。実在の人は出さない。
   *   企業ページの現役社員は検証用を除くので、そのままでは検証用アカウントで「出る側」を一度も確かめられなかったため。
   *   ⚠️ 実在の利用者（false）の見え方は変えていない。検証用の人は実在の利用者には出ない
   */
  viewerIsTest = false,
): Promise<CompanyConnection[] | null> {
  const current = viewerIsTest
    ? await testEmployeesOf(companyId, viewerOwUserId)
    : (await getCompanyEmployeesCached(companyId)).current.filter((e) => e.userId && e.userId !== viewerOwUserId);
  if (current === null) return null;
  if (current.length === 0) return [];
  const ids = current.map((e) => e.userId);

  const admin = createAdminClient();
  /* 相互フォロー: 閲覧者 → 相手 と 相手 → 閲覧者 の両方がある人 */
  const [out, inc] = await Promise.all([
    admin.from("ow_user_follows").select("target_user_id")
      .eq("follower_user_id", viewerOwUserId).in("target_user_id", ids),
    admin.from("ow_user_follows").select("follower_user_id")
      .eq("target_user_id", viewerOwUserId).in("follower_user_id", ids),
  ]);
  if (out.error) { console.error("[connections] follows out:", out.error.message); return null; }
  if (inc.error) { console.error("[connections] follows in:", inc.error.message); return null; }
  const following = new Set((out.data ?? []).map((r) => r.target_user_id as string));
  const followers = new Set((inc.data ?? []).map((r) => r.follower_user_id as string));
  const mutual = Array.from(followers).filter((id) => following.has(id));
  if (mutual.length === 0) return [];

  /* 本人の同意（auth 空間へ写して ow_profiles を引く） */
  const { data: users, error: uErr } = await admin.from("ow_users").select("id, auth_id").in("id", mutual);
  if (uErr) { console.error("[connections] ow_users:", uErr.message); return null; }
  const authToOw = new Map<string, string>();
  for (const u of users ?? []) if (u.auth_id) authToOw.set(u.auth_id as string, u.id as string);
  if (authToOw.size === 0) return [];

  const { data: profs, error: pErr } = await admin
    .from("ow_profiles").select("user_id")
    .in("user_id", Array.from(authToOw.keys()))
    .eq("show_as_connection", true);
  if (pErr) { console.error("[connections] ow_profiles:", pErr.message); return null; }
  const consented = new Set((profs ?? []).map((p) => authToOw.get(p.user_id as string)).filter(Boolean) as string[]);

  return pickConnections({ current, viewerOwUserId, following, followers, consented })
    .map((e) => ({
      userId: e.userId,
      name: e.name,
      avatarUrl: e.avatarUrl,
      avatarInitial: e.avatarInitial,
      avatarGradient: e.avatarGradient,
    }));
}

/**
 * 検証用アカウントの閲覧者のための候補: その会社に在籍中（is_current）の**検証用**アカウント。
 * ⚠️ 現役社員の一覧（getCompanyEmployees）と同じく、非公開（private）・会社名を伏せた職歴（hidden）・未登録の人は除く
 */
async function testEmployeesOf(companyId: string, viewerOwUserId: string) {
  const { data, error } = await createAdminClient()
    .from("ow_experiences")
    .select("visibility_company, ow_users!user_id(id, name, avatar_url, avatar_color, visibility, is_test, auth_id)")
    .eq("company_id", companyId).eq("is_current", true);
  if (error) { console.error("[connections] test employees:", error.message); return null; }
  type U = { id: string; name: string | null; avatar_url: string | null; avatar_color: string | null; visibility: string | null; is_test: boolean | null; auth_id: string | null };
  const out: { userId: string; name: string; avatarUrl: string | null; avatarInitial: string; avatarGradient: string }[] = [];
  for (const r of data ?? []) {
    const u = (Array.isArray(r.ow_users) ? r.ow_users[0] : r.ow_users) as unknown as U | null;
    if (!u || u.is_test !== true || u.visibility === "private" || !isRegisteredUser(u) || r.visibility_company === "hidden") continue;
    if (u.id === viewerOwUserId) continue;
    const name = u.name ?? "—";
    out.push({
      userId: u.id, name, avatarUrl: u.avatar_url, avatarInitial: name.charAt(0),
      avatarGradient: u.avatar_color ? `linear-gradient(135deg, ${u.avatar_color}99, ${u.avatar_color})` : "linear-gradient(135deg, var(--royal), #3B5FD9)",
    });
  }
  return out;
}
