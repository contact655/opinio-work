import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_CAREER_FACT_COUNT } from "@/lib/constants/aggregate";
import { AGGREGATE_USER_COLUMNS, isAggregatableUser, type AggregateUser } from "@/lib/aggregate/population";
import { computeCurrentDestinations } from "@/lib/companyFlow/compute";
import type { Destinations } from "./runSearch";

/**
 * ★「〈学校〉を出た人の、いま」の中身（2026-10-21）。**検索結果（学校で引いたとき）と学校のページが同じ関数を使う。**
 *   渡した人たちの**いまの**職歴（現職・会社名を出してよいもの＝visibility_company 'real'）から、業界と職種を数える。
 * ★★2026-10-27 に「人の流れ」と同じ規則にそろえた（柴さんの決定）: 業界は大分類・職種は大分類・3人以上（MIN_CAREER_FACT_COUNT）・
 *    **会社名は出さない**。それまでは会社名と職種を、5人以上のときだけ並べていた。数え方は lib/companyFlow の computeCurrentDestinations
 * ★★統計利用を停止した人は数えない（`isAggregatableUser`）
 * ⚠️ 呼ぶ側が「誰を渡すか」（卒業生だけ）と「ログイン中か」を決める。ここでは絞らない
 */
export async function destinationsForUsers(userIds: string[]): Promise<Destinations | undefined> {
  if (userIds.length === 0) return undefined;
  const db = createAdminClient();
  const [expRes, indRes, roleRes] = await Promise.all([
    db.from("ow_experiences")
      .select(`user_id, role_category_id, ow_companies!company_id(industry_id), ow_users!user_id(${AGGREGATE_USER_COLUMNS})`)
      .in("user_id", userIds).eq("is_current", true).eq("visibility_company", "real"),
    db.from("ow_industries").select("id, name, parent_id"),
    db.from("ow_roles").select("id, name, parent_id"),
  ]);
  /* ⚠️ 取得に失敗したら何も出さない（0件と混ぜない） */
  if (expRes.error || indRes.error || roleRes.error) {
    console.error("[destinations] load:", expRes.error?.message ?? indRes.error?.message ?? roleRes.error?.message);
    return undefined;
  }
  const industries = new Map(((indRes.data ?? []) as { id: string; name: string; parent_id: string | null }[]).map((i) => [i.id, i]));
  const roles = (roleRes.data ?? []) as { id: string; name: string; parent_id: string | null }[];
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const roleParent = new Map(roles.map((r) => [r.id, r.parent_id]));
  const roleTop = (id: string | null): string | null => {
    let cur: string | null | undefined = id;
    for (let i = 0; i < 5 && cur && roleParent.get(cur); i++) cur = roleParent.get(cur);
    return (cur && roleName.get(cur)) ?? null;
  };
  type Row = { user_id: string; role_category_id: string | null; ow_companies: { industry_id: string | null } | null; ow_users: AggregateUser | null };
  const rows = ((expRes.data ?? []) as unknown as Row[])
    .filter((e) => isAggregatableUser(e.ow_users))
    .map((e) => {
      const ind = e.ow_companies?.industry_id ? industries.get(e.ow_companies.industry_id) : undefined;
      return { userId: e.user_id, industryParentId: ind ? (ind.parent_id ?? ind.id) : null, roleTopLabel: roleTop(e.role_category_id) };
    });
  const d = computeCurrentDestinations(rows, (id) => industries.get(id)?.name ?? "", MIN_CAREER_FACT_COUNT);
  return d ?? undefined;
}
