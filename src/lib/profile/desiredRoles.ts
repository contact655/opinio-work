import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import { getRoleTree } from "@/lib/supabase/queries";
import { expandWithAncestors } from "@/lib/roles/jobRoles";

/**
 * 希望職種（ow_profile_desired_roles）の読み取り。
 *
 * ⚠️ user_id は **auth.users.id**。ow_users.id ではない（docs/user-id-spaces.md）。
 *
 * ⚠️ `expandedIds` は「本人が選んだ職種 ＋ その祖先」。
 *    求人側（Job.roleIds）も同じ展開をしているので、
 *    大分類でも子階層でも `includes()` の同じ判定で突き合わせられる。
 *    **絞り込みには expandedIds、表示には names を使う。**
 *    展開後の名前を表示すると、選んでいない「営業」まで出て嘘になる。
 *
 * ⚠️ no-store クライアントで引く。本人が希望職種を保存した直後に /jobs を開くので、
 *    Next の fetch キャッシュに載ると古い結果を返す（CLAUDE.md「supabase-js の
 *    fetch キャッシュ」）。実際 createAdminClient のままだと、保存したのに
 *    「あなたの希望職種にマッチ」が出なかった。
 * ⚠️ この2関数を `unstable_cache` の中から呼ばないこと。
 *    no-store fetch が静的プリレンダリングで DynamicServerError になる。
 */
export type DesiredRoles = {
  /** 本人が選んだ role_id（展開前） */
  ids: string[];
  /** 選んだ職種 ＋ 祖先。突き合わせ用 */
  expandedIds: string[];
  /** 本人が選んだ職種の名前（展開前） */
  names: string[];
};

const EMPTY: DesiredRoles = { ids: [], expandedIds: [], names: [] };

export async function getDesiredRoles(authUserId: string): Promise<DesiredRoles> {
  const admin = createNoStoreAdminClient();
  const { data, error } = await admin
    .from("ow_profile_desired_roles")
    .select("role_id")
    .eq("user_id", authUserId);

  if (error) {
    console.error("[getDesiredRoles]", error.message);
    return EMPTY;
  }
  const ids = (data ?? []).map((r) => r.role_id as string);
  if (ids.length === 0) return EMPTY;

  const tree = await getRoleTree();
  return {
    ids,
    expandedIds: expandWithAncestors(tree, ids),
    names: ids.map((id) => tree.byId.get(id)?.name).filter((n): n is string => !!n),
  };
}

/**
 * 複数ユーザーぶんをまとめて引く（/biz/candidates 用）。
 * 戻り値は auth.users.id → DesiredRoles。
 */
export async function getDesiredRolesFor(
  authUserIds: string[]
): Promise<Map<string, DesiredRoles>> {
  const out = new Map<string, DesiredRoles>();
  if (authUserIds.length === 0) return out;

  const admin = createNoStoreAdminClient();
  const { data, error } = await admin
    .from("ow_profile_desired_roles")
    .select("user_id, role_id")
    .in("user_id", authUserIds);

  if (error) {
    console.error("[getDesiredRolesFor]", error.message);
    return out;
  }

  const byUser = new Map<string, string[]>();
  for (const r of data ?? []) {
    const uid = r.user_id as string;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(r.role_id as string);
  }
  if (byUser.size === 0) return out;

  const tree = await getRoleTree();
  byUser.forEach((ids, uid) => {
    out.set(uid, {
      ids,
      expandedIds: expandWithAncestors(tree, ids),
      names: ids.map((id) => tree.byId.get(id)?.name).filter((n): n is string => !!n),
    });
  });
  return out;
}
