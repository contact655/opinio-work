import { createAdminClient } from "@/lib/supabase/admin";

/**
 * フォロワー数 / フォロー中の数。
 *
 * ── 出し方の方針（2026-08-04）────────────────────────────────────────────────
 * プロフィールの主役は経歴。数字がその人の価値の代理指標に見えないよう、
 * 名前・職種・所属より下の控えめなメタ行に置く。
 *
 * ⚠️ 0 のときは項目ごと出さない。「フォロワー 0」が並ぶのを避けるため。
 *    値が無いものを出さない原則と同じ扱い。呼び出し側で 0 を弾くのではなく、
 *    表示コンポーネント（FollowCounts）が 0 を自分で落とす。
 *
 * ⚠️ 「フォロワーを増やしましょう」の類の催促は書かない。
 *    つながること自体が目的化する仕組みを避けるため。
 */
export type FollowCounts = {
  /** この人をフォローしている人数 */
  followers: number;
  /** この人がフォローしている人数 */
  following: number;
};

export async function getFollowCounts(owUserId: string): Promise<FollowCounts> {
  const db = createAdminClient();

  const [followersRes, followingRes] = await Promise.all([
    db.from("ow_user_follows").select("*", { count: "exact", head: true }).eq("target_user_id", owUserId),
    db.from("ow_user_follows").select("*", { count: "exact", head: true }).eq("follower_user_id", owUserId),
  ]);

  if (followersRes.error) console.error("[followCounts followers]", followersRes.error.message);
  if (followingRes.error) console.error("[followCounts following]", followingRes.error.message);

  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}
