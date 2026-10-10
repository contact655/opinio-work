/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPROACH_EXPIRE_DAYS } from "@/lib/constants/companyApproaches";

/**
 * ★声かけの振り返り（2026-10-10 / 声かけまわり 段6）。/biz/analytics の「声かけ」タブ。
 *
 * - **承認率の分母は「結果の出た件数」** = 承認された ＋ 送ってから30日を過ぎた承認待ち。
 *   見送りと返事なしは区別しない（見送られても30日までは「承認待ち」で、分母に入らない）。
 * - 結果の出た件数が10件未満なら、承認率に「参考値」を付ける（`REFERENCE_ONLY_BELOW`）。
 * - 表の行ごとに、結果の出た件数が5件未満なら率は「—」にして件数だけ出す（`ROW_RATE_MIN`）。
 * - 「面談につながった」= 承認された声かけのうち、その会話に面談（ow_meetings。取り消しを除く）があるもの。
 * - ⚠️ 検証用アカウント（送った担当者か相手が is_test）は除く。ただし企業自身が is_test なら数える（2026-10-11）。
 * - 関連する求人・テンプレートは 2026-10-10 から記録（それより前の行は「記録なし」）。
 */
export const REFERENCE_ONLY_BELOW = 10;
export const ROW_RATE_MIN = 5;

export type AnalyticsCell = { sent: number; accepted: number; resolved: number; meetings: number };
export type AnalyticsRow = AnalyticsCell & { key: string; label: string };
export type ApproachAnalytics = {
  total: AnalyticsCell;
  bySender: AnalyticsRow[];
  byJob: AnalyticsRow[];
  byReasonLength: AnalyticsRow[];
  byTemplate: AnalyticsRow[];
};

const REASON_BUCKETS = [
  { key: "30-79", label: "30〜79字", min: 30, max: 79 },
  { key: "80-139", label: "80〜139字", min: 80, max: 139 },
  { key: "140-200", label: "140〜200字", min: 140, max: 200 },
] as const;

const empty = (): AnalyticsCell => ({ sent: 0, accepted: 0, resolved: 0, meetings: 0 });

/** 返信率（%・整数。2026-10-11 に小数1桁から整数へ。/biz/approaches の「返信率 N%」と揃える）。分母が0なら null */
export function acceptRate(c: AnalyticsCell): number | null {
  return c.resolved > 0 ? Math.round((c.accepted / c.resolved) * 100) : null;
}

/**
 * 期間（送った日で絞る。null は全期間）の集計。取得に失敗したら null（画面は「—」。0 と出さない）。
 * ⚠️ `includeTest` は検証用。画面からは渡さない。
 */
export async function getApproachAnalytics(companyId: string, sinceMs: number | null, opts: { includeTest?: boolean; now?: Date } = {}): Promise<ApproachAnalytics | null> {
  const db = createAdminClient();
  let q = db.from("ow_company_approaches")
    .select("id, created_at, accepted_at, reason, sender_user_id, candidate_user_id, conversation_id, job_id, template_id, attribution_recorded")
    .eq("company_id", companyId);
  if (sinceMs !== null) q = q.gte("created_at", new Date(sinceMs).toISOString());
  const { data, error } = await q;
  if (error) { console.error("[approaches/analytics]", error.message); return null; }
  let rows = data ?? [];

  const userIds = Array.from(new Set(rows.flatMap((r) => [r.sender_user_id as string | null, r.candidate_user_id as string]).filter(Boolean) as string[]));
  const convIds = Array.from(new Set(rows.map((r) => r.conversation_id as string | null).filter(Boolean) as string[]));
  const jobIds = Array.from(new Set(rows.map((r) => r.job_id as string | null).filter(Boolean) as string[]));
  const [users, meetings, jobs] = await Promise.all([
    userIds.length ? db.from("ow_users").select("id, name, is_test").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    convIds.length ? db.from("ow_meetings").select("conversation_id").in("conversation_id", convIds).eq("status", "scheduled") : Promise.resolve({ data: [], error: null }),
    jobIds.length ? db.from("ow_jobs").select("id, title").in("id", jobIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [users, meetings, jobs]) if (r.error) { console.error("[approaches/analytics] join:", r.error.message); return null; }
  const userById = new Map((users.data ?? []).map((u) => [u.id as string, u]));
  const meetingConvs = new Set((meetings.data ?? []).map((m) => m.conversation_id as string));

  /* ★検証用の企業（自身が is_test）は検証用の担当者・相手も数える（2026-10-11 / 柴さんの判断）。
        声かけは is_test 同士でしか送れないので、外すと検証用の企業では常に0件になる。
        ⚠️ 実在の企業は今までどおり検証用を外す。取れなければ外す側（実在の企業と同じ扱い）。 */
  const { data: comp, error: cErr } = await db.from("ow_companies").select("is_test").eq("id", companyId).maybeSingle();
  if (cErr) console.error("[approaches/analytics] company:", cErr.message);
  if (!opts.includeTest && comp?.is_test !== true) {
    rows = rows.filter((r) => {
      const s = r.sender_user_id ? userById.get(r.sender_user_id as string) : null;
      const c = userById.get(r.candidate_user_id as string);
      return s?.is_test !== true && c?.is_test !== true;
    });
  }

  const now = (opts.now ?? new Date()).getTime();
  const expireMs = APPROACH_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
  const total = empty();
  const bySender = new Map<string, AnalyticsRow>();
  const byJob = new Map<string, AnalyticsRow>();
  const byReason = new Map<string, AnalyticsRow>(REASON_BUCKETS.map((b) => [b.key, { key: b.key, label: b.label, ...empty() }]));
  const byTemplate = new Map<string, AnalyticsRow>();
  const add = (m: Map<string, AnalyticsRow>, key: string, label: string, f: (c: AnalyticsCell) => void) => {
    if (!m.has(key)) m.set(key, { key, label, ...empty() });
    f(m.get(key)!);
  };

  for (const r of rows) {
    const accepted = !!r.accepted_at;
    const resolved = accepted || now - new Date(r.created_at as string).getTime() > expireMs;
    const meeting = accepted && !!r.conversation_id && meetingConvs.has(r.conversation_id as string);
    const apply = (c: AnalyticsCell) => { c.sent++; if (accepted) c.accepted++; if (resolved) c.resolved++; if (meeting) c.meetings++; };
    apply(total);
    const sender = r.sender_user_id ? userById.get(r.sender_user_id as string) : null;
    add(bySender, (r.sender_user_id as string) ?? "-", ((sender?.name as string | null) ?? "").trim() || "（記録なし）", apply);
    if (!r.attribution_recorded) {
      add(byJob, "none-recorded", "記録なし", apply);
      add(byTemplate, "none-recorded", "記録なし", apply);
    } else {
      add(byJob, r.job_id ? "with" : "without", r.job_id ? "求人を添えた" : "添えていない", apply);
      add(byTemplate, (r.template_id as string) ?? "none", r.template_id ? `テンプレート ${(r.template_id as string).slice(0, 8)}` : "テンプレートなし", apply);
    }
    const len = ((r.reason as string) ?? "").trim().length;
    const b = REASON_BUCKETS.find((x) => len >= x.min && len <= x.max);
    if (b) apply(byReason.get(b.key)!);
  }
  const sorted = (m: Map<string, AnalyticsRow>) => Array.from(m.values()).sort((a, b) => b.sent - a.sent);
  return { total, bySender: sorted(bySender), byJob: sorted(byJob), byReasonLength: Array.from(byReason.values()), byTemplate: sorted(byTemplate) };
}
