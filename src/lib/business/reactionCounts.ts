/* ★サーバー専用。admin クライアントを使う（検証用アカウントの判定） */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★企業に届いた面談申込・応募（2026-10-09）。**求人管理（/biz/jobs）と分析（/biz/analytics）の数え方はここの1か所。**
 *
 * ⚠️★検証用アカウント（is_test）の申込・応募は数えない。2つの画面で同じ関数を通すので、
 *    求人ごとの数字は必ず一致する。⚠️ どちらかの画面に数え方を書き写さないこと。
 * ⚠️ `lib/business/jobs.ts` に置かない —— あのファイルはクライアントの `JobEditForm` も読むので、
 *    admin クライアントを入れられない（server-only でビルドが落ちる）。
 * ⚠️ 取得に失敗したら `{ ok: false }`。0 件に倒さない（呼び出し側で「取得できませんでした」にする）。
 */
export type ReactionRow = { status: string | null; created_at: string; job_id: string | null };
export type Fetched<T> = { ok: true; rows: T[] } | { ok: false };
export type CompanyReactions = { meetings: Fetched<ReactionRow>; applications: Fetched<ReactionRow> };

/** 検証用アカウントの ow_users.id。⚠️ 埋め込みにしない（ow_casual_meetings は ow_users への FK が3本あり曖昧） */
async function fetchTestUserIds(userIds: string[]): Promise<Set<string> | null> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Set();
  const { data, error } = await createAdminClient()
    .from("ow_users").select("id").in("id", ids).eq("is_test", true);
  if (error) { console.error("[reactionCounts] is_test:", error.message); return null; }
  return new Set((data ?? []).map((r) => r.id as string));
}

type RawRow = { status: string | null; created_at: string | null; job_id: string | null; user_id: string | null };

async function dropTestRows(rows: RawRow[]): Promise<Fetched<ReactionRow>> {
  const test = await fetchTestUserIds(rows.map((r) => r.user_id ?? ""));
  if (!test) return { ok: false };
  /* ⚠️ 日時の無い行は期間にも月にも入れられないので数えない */
  return {
    ok: true,
    rows: rows.flatMap((r) =>
      r.created_at && !(r.user_id && test.has(r.user_id))
        ? [{ status: r.status, created_at: r.created_at, job_id: r.job_id }]
        : []),
  };
}

/** ⚠️ `supabase` はセッションのクライアント（企業の担当者として読む。RLS で自社の分だけ） */
export async function fetchCompanyReactions(supabase: SupabaseClient, tenantId: string): Promise<CompanyReactions> {
  const [m, a] = await Promise.all([
    supabase.from("ow_casual_meetings").select("status, created_at, job_id, user_id").eq("company_id", tenantId),
    supabase.from("ow_job_applications").select("status, created_at, job_id, user_id, ow_jobs!inner(company_id)").eq("ow_jobs.company_id", tenantId),
  ]);
  if (m.error) console.error("[reactionCounts] meetings:", m.error.message);
  if (a.error) console.error("[reactionCounts] applications:", a.error.message);
  const [meetings, applications] = await Promise.all([
    m.error ? Promise.resolve({ ok: false } as const) : dropTestRows((m.data ?? []) as RawRow[]),
    a.error ? Promise.resolve({ ok: false } as const) : dropTestRows((a.data ?? []) as RawRow[]),
  ]);
  return { meetings, applications };
}

export type JobReactionCounts = { meetings: Record<string, number>; applications: Record<string, number> };

/** 求人ごとの数（全期間）。⚠️ 面談は辞退を除く（求人管理のカードの定義）。取得に失敗した側は空 */
export function countByJob(r: CompanyReactions): JobReactionCounts {
  const meetings: Record<string, number> = {};
  if (r.meetings.ok) for (const m of r.meetings.rows) if (m.job_id && m.status !== "declined") meetings[m.job_id] = (meetings[m.job_id] ?? 0) + 1;
  const applications: Record<string, number> = {};
  if (r.applications.ok) for (const x of r.applications.rows) if (x.job_id) applications[x.job_id] = (applications[x.job_id] ?? 0) + 1;
  return { meetings, applications };
}
