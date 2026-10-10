/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CANDIDATE_NOTE_MAX, isCandidateStage, type CandidateStage } from "@/lib/constants/candidateNotes";

/**
 * ★社内メモと候補者の社内の状態（2026-10-10 / 声かけまわり 段5）。**読み書きはここの1か所。**
 *
 * ⚠️★フラグ（`CANDIDATE_NOTES_ENABLED`）で本番はオフ。プライバシーポリシーを改定してからオンにする。
 *    オフのあいだ API は 404、画面には出さない。dev（NODE_ENV が production でない）は既定でオン
 *    （"false" を入れると切れる）。⚠️ Vercel のプレビューも production 扱いなのでオフ。
 * ⚠️ 表はクライアントのロールに GRANT していない（PostgREST から直接は誰も読めない）。
 *    呼び出し側（API）が「その企業の有効な担当者」であることを確かめてから呼ぶ。
 * ⚠️ 書ける相手は `canWriteCandidateNote`（検索で見られる／応募・面談申込／会話あり。ブロックされていない）。
 *    読むのは自社の記録なので制限しない（ブロックされた企業の分は DB のトリガーが消している）。
 */
export function isCandidateNotesEnabled(): boolean {
  const v = process.env.CANDIDATE_NOTES_ENABLED;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export type Result<T = null> = { ok: true; data: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): Result<never> => ({ ok: false, status, error });

export type CandidateNote = { id: string; body: string; createdAt: string; authorId: string | null; authorName: string | null };
export type CandidateTracking = { stage: CandidateStage | null; ownerId: string | null; ownerName: string | null; updatedAt: string | null };

/**
 * ★書ける相手（2026-10-10 / 柴さんの指示）。次のどれかに当てはまる人:
 *   ① 候補者検索で見られる人（`can_send_scout()`）
 *   ② 自社に応募した人（ow_job_applications。求人がこの会社のもの）か、面談申込をした人（ow_casual_meetings）
 *   ③ 自社と会話が開いている人（企業との会話。声かけ・提案などから）
 * ⚠️★求職者がこの企業をブロックしていたら、どれに当てはまっても書けない（ブロックした時点で
 *    メモ・担当・状態は DB のトリガーが消している。`purge_candidate_notes_on_block`）。
 * ⚠️ どれにも当てはまらなくなった人（転職意欲を変えた・グループ会社に入った 等）は、メモは読めるが書けない。
 * 判定できなかったら false（書かせない）。
 */
export async function canWriteCandidateNote(companyId: string, candidateOwUserId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: u, error } = await db.from("ow_users").select("auth_id").eq("id", candidateOwUserId).maybeSingle();
  if (error || !u?.auth_id) { if (error) console.error("[candidateNotes] user:", error.message); return false; }
  const authId = u.auth_id as string;
  const [blk, vis, apps, meet, conv] = await Promise.all([
    db.from("ow_scout_blocks").select("id", { count: "exact", head: true }).eq("candidate_id", authId).eq("company_id", companyId),
    db.rpc("can_send_scout", { p_company_id: companyId, p_candidate_id: authId }),
    db.from("ow_job_applications").select("id, ow_jobs!inner(company_id)", { count: "exact", head: true }).eq("user_id", candidateOwUserId).eq("ow_jobs.company_id", companyId),
    db.from("ow_casual_meetings").select("id", { count: "exact", head: true }).eq("user_id", candidateOwUserId).eq("company_id", companyId),
    db.from("ow_conversations").select("id", { count: "exact", head: true }).eq("kind", "company").eq("company_id", companyId).eq("candidate_user_id", candidateOwUserId),
  ]);
  for (const r of [blk, vis, apps, meet, conv]) if (r.error) { console.error("[candidateNotes] canWrite:", r.error.message); return false; }
  if ((blk.count ?? 0) > 0) return false;
  return vis.data === true || (apps.count ?? 0) > 0 || (meet.count ?? 0) > 0 || (conv.count ?? 0) > 0;
}

export async function getCandidateNotes(companyId: string, candidateOwUserId: string): Promise<{ notes: CandidateNote[]; tracking: CandidateTracking; writable?: boolean } | null> {
  const db = createAdminClient();
  const [{ data: notes, error: nErr }, { data: tr, error: tErr }] = await Promise.all([
    db.from("ow_candidate_notes").select("id, body, created_at, author_id").eq("company_id", companyId)
      .eq("candidate_user_id", candidateOwUserId).order("created_at", { ascending: false }),
    db.from("ow_candidate_tracking").select("stage, owner_id, updated_at").eq("company_id", companyId).eq("candidate_user_id", candidateOwUserId).maybeSingle(),
  ]);
  if (nErr || tErr) { console.error("[candidateNotes] get:", nErr?.message ?? tErr?.message); return null; }
  const ids = Array.from(new Set([...(notes ?? []).map((n) => n.author_id as string | null), tr?.owner_id as string | null].filter(Boolean) as string[]));
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: us } = await db.from("ow_users").select("id, name").in("id", ids);
    for (const u of us ?? []) names.set(u.id as string, ((u.name as string | null) ?? "").trim() || "担当者");
  }
  return {
    notes: (notes ?? []).map((n) => ({ id: n.id as string, body: n.body as string, createdAt: n.created_at as string,
      authorId: (n.author_id as string | null) ?? null, authorName: n.author_id ? names.get(n.author_id as string) ?? null : null })),
    tracking: {
      stage: (tr?.stage as CandidateStage | null) ?? null, ownerId: (tr?.owner_id as string | null) ?? null,
      ownerName: tr?.owner_id ? names.get(tr.owner_id as string) ?? null : null, updatedAt: (tr?.updated_at as string | null) ?? null,
    },
  };
}

export async function addCandidateNote(companyId: string, candidateOwUserId: string, authorOwUserId: string, raw: unknown): Promise<Result<{ id: string }>> {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body) return fail(400, "メモを入れてください");
  if (body.length > CANDIDATE_NOTE_MAX) return fail(400, `メモは${CANDIDATE_NOTE_MAX}字までです`);
  if (!(await canWriteCandidateNote(companyId, candidateOwUserId))) return fail(403, "この方には、いまはメモを残せません");
  const { data, error } = await createAdminClient().from("ow_candidate_notes")
    .insert({ company_id: companyId, candidate_user_id: candidateOwUserId, author_id: authorOwUserId, body }).select("id").single();
  if (error || !data) { console.error("[candidateNotes] add:", error?.message); return fail(500, "保存できませんでした"); }
  return { ok: true, data: { id: data.id as string } };
}

/**
 * 消す。★**その場で行ごと消す**（2026-10-10 / 柴さんの判断）。見えなくするだけの論理削除にしない。
 * ⚠️ 消したことの記録も残さない（本文も、誰が消したかも）。⚠️ 自社のメモだけ
 */
export async function deleteCandidateNote(companyId: string, candidateOwUserId: string, noteId: string): Promise<Result> {
  const { data, error } = await createAdminClient().from("ow_candidate_notes").delete()
    .eq("id", noteId).eq("company_id", companyId).eq("candidate_user_id", candidateOwUserId).select("id");
  if (error) { console.error("[candidateNotes] delete:", error.message); return fail(500, "消せませんでした"); }
  if ((data ?? []).length !== 1) return fail(404, "メモが見つかりません");
  return { ok: true, data: null };
}

/** 状態と担当を決める。stage が null なら状態を外す。⚠️ 担当はその企業の有効な担当者だけ。
 *  ⚠️ ownerRaw が undefined（送られていない）なら、いまの担当をそのまま残す（カードの「気になる」から呼ぶとき） */
export async function setCandidateTracking(companyId: string, candidateOwUserId: string, stageRaw: unknown, ownerRaw: unknown): Promise<Result<CandidateTracking>> {
  const stage = stageRaw === null || stageRaw === "" ? null : stageRaw;
  if (stage !== null && !isCandidateStage(stage)) return fail(400, "状態の値が正しくありません");
  if (!(await canWriteCandidateNote(companyId, candidateOwUserId))) return fail(403, "この方の状態は、いまは変えられません");
  const db = createAdminClient();
  let ownerId: unknown = ownerRaw === null || ownerRaw === "" ? null : ownerRaw;
  if (ownerRaw === undefined) {
    const { data: cur } = await db.from("ow_candidate_tracking").select("owner_id").eq("company_id", companyId).eq("candidate_user_id", candidateOwUserId).maybeSingle();
    ownerId = (cur?.owner_id as string | null) ?? null;
  }
  if (ownerId !== null && typeof ownerId !== "string") return fail(400, "担当の値が正しくありません");
  if (ownerId) {
    const { data: link } = await db.from("ow_company_admins").select("id").eq("company_id", companyId).eq("user_id", ownerId).eq("is_active", true).maybeSingle();
    if (!link) return fail(400, "担当は、この会社の担当者から選んでください");
  }
  const { error } = await db.from("ow_candidate_tracking").upsert({
    company_id: companyId, candidate_user_id: candidateOwUserId, stage: stage as CandidateStage | null, owner_id: ownerId as string | null, updated_at: new Date().toISOString(),
  }, { onConflict: "company_id,candidate_user_id" });
  if (error) { console.error("[candidateNotes] tracking:", error.message); return fail(500, "保存できませんでした"); }
  const got = await getCandidateNotes(companyId, candidateOwUserId);
  return got ? { ok: true, data: got.tracking } : fail(500, "保存しましたが、読み直せませんでした");
}

/** 候補者検索のカード用: 状態だけまとめて。失敗したら null */
export async function listCandidateStages(companyId: string, candidateOwUserIds: string[]): Promise<Map<string, CandidateStage> | null> {
  if (candidateOwUserIds.length === 0) return new Map();
  const { data, error } = await createAdminClient().from("ow_candidate_tracking").select("candidate_user_id, stage")
    .eq("company_id", companyId).in("candidate_user_id", candidateOwUserIds).not("stage", "is", null);
  if (error) { console.error("[candidateNotes] stages:", error.message); return null; }
  return new Map((data ?? []).map((r) => [r.candidate_user_id as string, r.stage as CandidateStage]));
}
