/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSavedFilters, type SavedCandidateFilters } from "@/lib/business/savedSearch";
import { filterCandidates, isNewSince, type Candidate } from "@/lib/business/candidates/model";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import type { PlanType } from "@/lib/constants/plans";

/**
 * ★保存した条件（2026-10-10 / 候補者探し 段3）。見える範囲・前回見た日時・新着の数。
 *
 * | 誰が | できること |
 * |---|---|
 * | 作った人 | 見る・この条件で探す・編集・削除 |
 * | 同じ企業の担当者（共有のときだけ） | 見る・この条件で探す |
 * | 企業の管理者（permission = admin） | 上に加えて、**他の人が作った条件も削除**（作った人が辞めたとき用） |
 *
 * ⚠️★新着の判定は `model.ts` の `isNewSince` の1か所（登録日と本人の編集日だけ）。
 * ⚠️★数は `loadCompanyCandidates`（`can_send_scout()` で見える人だけ）→ `filterCandidates` を通す。
 *    画面の一覧と同じ関数なので、見えない人を数えない。
 * ⚠️ 前回見た日時の初期値: 保存した時点（作った人）／共有された条件を他の担当者が**初めて開いた時点**。
 */

export const NOTIFY_FREQUENCIES = [
  { value: "daily", label: "毎朝" },
  { value: "weekly", label: "毎週月曜" },
  { value: "none", label: "受け取らない" },
] as const;
export type NotifyFrequency = (typeof NOTIFY_FREQUENCIES)[number]["value"];
export function isNotifyFrequency(v: unknown): v is NotifyFrequency {
  return typeof v === "string" && NOTIFY_FREQUENCIES.some((f) => f.value === v);
}

export type SavedSearchRow = {
  id: string;
  name: string;
  filters: SavedCandidateFilters;
  ownerUserId: string;
  ownerName: string | null;
  isShared: boolean;
  notifyFrequency: NotifyFrequency;
  updatedAt: string;
  createdAt: string;
  lastNotifiedAt: string | null;
};

export type SavedSearchForViewer = SavedSearchRow & {
  isMine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** この担当者の前回見た日時 */
  lastViewedAt: string;
  /** 新着の人数。null = 数えられなかった（画面は「—」） */
  newCount: number | null;
};

const COLS = "id, name, filters, owner_user_id, is_shared, notify_frequency, updated_at, created_at, last_notified_at";

function toRow(r: Record<string, unknown>, ownerName: string | null): SavedSearchRow {
  return {
    id: r.id as string,
    name: r.name as string,
    filters: parseSavedFilters(r.filters),
    ownerUserId: r.owner_user_id as string,
    ownerName,
    isShared: r.is_shared === true,
    notifyFrequency: isNotifyFrequency(r.notify_frequency) ? r.notify_frequency : "none",
    updatedAt: r.updated_at as string,
    createdAt: r.created_at as string,
    lastNotifiedAt: (r.last_notified_at as string | null) ?? null,
  };
}

/** この担当者が見られる条件（自分のもの＋同じ企業の共有）。取れなければ null */
export async function listSavedSearchesForViewer(params: {
  companyId: string;
  viewerOwUserId: string;
  viewerPermission: "admin" | "member";
}): Promise<SavedSearchRow[] | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_saved_candidate_searches")
    .select(COLS)
    .eq("company_id", params.companyId)
    .or(`owner_user_id.eq.${params.viewerOwUserId},is_shared.eq.true`)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[savedSearch] list:", error.message); return null; }
  const ownerIds = Array.from(new Set((data ?? []).map((r) => r.owner_user_id as string)));
  const { data: owners, error: oErr } = ownerIds.length
    ? await db.from("ow_users").select("id, name").in("id", ownerIds)
    : { data: [], error: null };
  if (oErr) console.error("[savedSearch] owners:", oErr.message);
  const nameOf = new Map((owners ?? []).map((u) => [u.id as string, ((u.name as string | null) ?? "").trim() || null]));
  return (data ?? []).map((r) => toRow(r, nameOf.get(r.owner_user_id as string) ?? null));
}

/** 1件（見られるときだけ）。⚠️ 他社・共有されていない他人の条件は null */
export async function getSavedSearchForViewer(params: { companyId: string; viewerOwUserId: string; id: string }): Promise<SavedSearchRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_saved_candidate_searches").select(COLS)
    .eq("id", params.id).eq("company_id", params.companyId).maybeSingle();
  if (error) { console.error("[savedSearch] get:", error.message); return null; }
  if (!data) return null;
  if (data.owner_user_id !== params.viewerOwUserId && data.is_shared !== true) return null;
  return toRow(data, null);
}

/**
 * 前回見た日時を引く。**無ければ今を初期値として入れる**（保存した直後・共有された条件を初めて開いたとき）。
 * ⚠️ 失敗したら今を返す（新着を多く数えない向き）。
 */
export async function ensureLastViewed(searchIds: string[], viewerOwUserId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (searchIds.length === 0) return out;
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db.from("ow_saved_search_views").select("search_id, last_viewed_at")
    .eq("viewer_user_id", viewerOwUserId).in("search_id", searchIds);
  if (error) console.error("[savedSearch] views:", error.message);
  for (const r of data ?? []) out.set(r.search_id as string, r.last_viewed_at as string);
  const missing = searchIds.filter((id) => !out.has(id));
  if (missing.length) {
    const { error: insErr } = await db.from("ow_saved_search_views")
      .upsert(missing.map((id) => ({ search_id: id, viewer_user_id: viewerOwUserId, last_viewed_at: now })), { onConflict: "search_id,viewer_user_id", ignoreDuplicates: true });
    if (insErr) console.error("[savedSearch] views init:", insErr.message);
    for (const id of missing) out.set(id, now);
  }
  return out;
}

/** その条件で一覧を開いた（前回見た日時を今にする） */
export async function markSavedSearchViewed(searchId: string, viewerOwUserId: string): Promise<boolean> {
  const { error } = await createAdminClient().from("ow_saved_search_views")
    .upsert({ search_id: searchId, viewer_user_id: viewerOwUserId, last_viewed_at: new Date().toISOString() }, { onConflict: "search_id,viewer_user_id" });
  if (error) { console.error("[savedSearch] mark viewed:", error.message); return false; }
  return true;
}

/** 新着の人数。⚠️ 見える人（can_send_scout）だけ・条件に合う人だけ・登録日か本人の編集日が since より後 */
export function countNew(candidates: Candidate[], filters: SavedCandidateFilters, sinceIso: string): number {
  return filterCandidates(candidates, filters).filter((c) => isNewSince(c, sinceIso)).length;
}

/** 画面用: 見られる条件 ＋ 前回見た日時 ＋ 新着の人数 ＋ できること */
export async function listSavedSearchesWithCounts(params: {
  companyId: string;
  viewerOwUserId: string;
  viewerPermission: "admin" | "member";
  planType: PlanType | null;
}): Promise<SavedSearchForViewer[] | null> {
  const rows = await listSavedSearchesForViewer(params);
  if (!rows) return null;
  const lastViewed = await ensureLastViewed(rows.map((r) => r.id), params.viewerOwUserId);
  let candidates: Candidate[] | null = null;
  if (rows.length) {
    try {
      candidates = (await loadCompanyCandidates({ companyId: params.companyId, viewerOwUserId: params.viewerOwUserId, planType: params.planType })).candidates;
    } catch (e) {
      console.error("[savedSearch] candidates:", e);
    }
  }
  return rows.map((r) => {
    const isMine = r.ownerUserId === params.viewerOwUserId;
    const since = lastViewed.get(r.id) ?? new Date().toISOString();
    return {
      ...r,
      isMine,
      canEdit: isMine,
      canDelete: isMine || params.viewerPermission === "admin",
      lastViewedAt: since,
      newCount: candidates ? countNew(candidates, r.filters, since) : null,
    };
  });
}
