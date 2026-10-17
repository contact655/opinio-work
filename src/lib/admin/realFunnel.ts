import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★実ユーザーだけのファネル（2026-10-17 / 柴さんの指示）。/admin のダッシュボードに出す。
 *
 * 実ユーザー = `is_test` でない・`is_system` でない・`auth_id` あり（本人が登録した人）。
 *   ⚠️ 条件は CLAUDE.md「取り残しを数える」と同じ。検証用を混ぜると比率が読めない
 *      （2026-09-01 に「完了率 79%」が実ユーザーだけなら 50% だった）。
 *
 * 段（どれも「人数」。行数ではない）:
 *   登録 → オンボーディング完了 → 職歴あり → 入社後レビューに回答 → 直近7日に利用
 *   ＋ 別枠: 応募・面談をした人
 *
 * ⚠️ 空間に注意。`ow_profiles.user_id` は auth 空間、それ以外（職歴・レビュー・応募・面談）は ow_users 空間。
 * ⚠️ 取得に失敗したら null を返す（0 に倒すと壊れているのに「0人」と読まれる）。
 */
export type RealFunnel = {
  registered: number;
  onboarded: number;
  withCareer: number;
  reviewed: number;
  activeLast7d: number;
  appliedOrMet: number;
  /** 直近の利用（last_active_at の最大）。誰も記録が無ければ null */
  lastActiveAt: string | null;
};

export const ACTIVE_WINDOW_DAYS = 7;

export async function loadRealFunnel(): Promise<RealFunnel | null> {
  const db = createAdminClient();
  const { data: users, error } = await db
    .from("ow_users")
    .select("id, auth_id, last_active_at")
    .eq("is_system", false)
    .not("is_test", "is", true)
    .not("auth_id", "is", null);
  if (error) {
    console.error("[realFunnel] ow_users:", error.message);
    return null;
  }
  const rows = (users ?? []) as { id: string; auth_id: string; last_active_at: string | null }[];
  const ids = rows.map((u) => u.id);
  const authIds = rows.map((u) => u.auth_id);
  if (ids.length === 0) {
    return { registered: 0, onboarded: 0, withCareer: 0, reviewed: 0, activeLast7d: 0, appliedOrMet: 0, lastActiveAt: null };
  }

  const [prof, exp, rev, app, meet] = await Promise.all([
    db.from("ow_profiles").select("user_id").in("user_id", authIds).eq("onboarding_completed", true),
    db.from("ow_experiences").select("user_id").in("user_id", ids),
    db.from("ow_workplace_reviews").select("user_id").in("user_id", ids),
    db.from("ow_job_applications").select("user_id").in("user_id", ids),
    db.from("ow_casual_meetings").select("user_id").in("user_id", ids),
  ]);
  for (const [label, r] of [["ow_profiles", prof], ["ow_experiences", exp], ["ow_workplace_reviews", rev], ["ow_job_applications", app], ["ow_casual_meetings", meet]] as const) {
    if (r.error) {
      console.error(`[realFunnel] ${label}:`, r.error.message);
      return null;
    }
  }
  const distinct = (r: { data: unknown }) => new Set(((r.data ?? []) as { user_id: string | null }[]).map((x) => x.user_id).filter(Boolean)).size;

  const since = Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000;
  const actives = rows.filter((u) => u.last_active_at && Date.parse(u.last_active_at) >= since).length;
  const last = rows.map((u) => u.last_active_at).filter((x): x is string => !!x).sort().pop() ?? null;

  const appliedOrMet = new Set(
    [...((app.data ?? []) as { user_id: string | null }[]), ...((meet.data ?? []) as { user_id: string | null }[])]
      .map((x) => x.user_id).filter(Boolean),
  ).size;

  return {
    registered: rows.length,
    onboarded: distinct(prof),
    withCareer: distinct(exp),
    reviewed: distinct(rev),
    activeLast7d: actives,
    appliedOrMet,
    lastActiveAt: last,
  };
}
