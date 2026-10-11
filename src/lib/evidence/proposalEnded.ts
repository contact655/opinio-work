/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { proposalPhase, PROPOSAL_RESPONSE_DAYS, daysLeftUntil } from "@/lib/constants/proposalResponses";

/**
 * 提案の「見せてよいか」と、求職者側の未回答の一覧（2026-10-11 に「求職者が先に答える」形へ作り替えた）。
 *
 * ⚠️★段（終了したか等）の判定は `proposalPhase()`（lib/constants/proposalResponses.ts）の1か所。ここに書き写さない。
 * ⚠️★企業側で提案を読むのは `lib/evidence/companyProposals.ts` だけ（求職者が答えた行しか返さない）。
 *    ここの `listOpenProposals` は**求職者側専用**。企業側から呼ばないこと。
 */

export { PROPOSAL_RESPONSE_DAYS };

/** 締め切りまで「あと◯日」（切り上げ。過ぎていれば 0） */
export function proposalDaysLeft(respondBy: string, now = new Date()): number {
  return daysLeftUntil(respondBy, now);
}

const pairKey = (companyId: string, candidateUserId: string) => `${companyId}:${candidateUserId}`;

/**
 * いま見せてよい（企業 × 候補者）の組を返す。⚠️ 判定は `can_send_scout()` そのもの。
 * ⚠️ 失敗したら**見せない側**に倒す。黙らずログを出す。
 */
export async function visiblePairs(
  pairs: { companyId: string; candidateUserId: string }[],
): Promise<Set<string>> {
  const out = new Set<string>();
  if (pairs.length === 0) return out;
  const db = createAdminClient();
  const userIds = Array.from(new Set(pairs.map((p) => p.candidateUserId)));
  const { data: users, error } = await db.from("ow_users").select("id, auth_id").in("id", userIds);
  if (error) {
    console.error("[proposalEnded] ow_users:", error.message);
    return out;
  }
  const authById = new Map((users ?? []).map((u) => [u.id as string, (u.auth_id as string | null) ?? null]));
  const uniq = Array.from(new Map(pairs.map((p) => [pairKey(p.companyId, p.candidateUserId), p])).values());
  await Promise.all(
    uniq.map(async (p) => {
      const authId = authById.get(p.candidateUserId);
      if (!authId) return;
      /* ⚠️ `p_candidate_id` は auth 空間 */
      const { data, error: rpcErr } = await db.rpc("can_send_scout", {
        p_company_id: p.companyId,
        p_candidate_id: authId,
      });
      if (rpcErr) console.error("[proposalEnded] can_send_scout:", rpcErr.message);
      if (data === true) out.add(pairKey(p.companyId, p.candidateUserId));
    }),
  );
  return out;
}

export function isVisiblePair(visible: Set<string>, p: { companyId: string; candidateUserId: string }): boolean {
  return visible.has(pairKey(p.companyId, p.candidateUserId));
}

/** ★提案の行（段の判定に要る列）。⚠️ select からどれかを落とすと判定が静かに変わるので、ここで1つに決める */
export const PROPOSAL_PHASE_COLS =
  "candidate_response, company_response, introduced_at, respond_by, delivery_mode, company_respond_by" as const;

export function phaseInputOf(r: Record<string, unknown>) {
  return {
    candidateResponse: (r.candidate_response as string | null) ?? null,
    companyResponse: (r.company_response as string | null) ?? null,
    introducedAt: (r.introduced_at as string | null) ?? null,
    respondBy: r.respond_by as string,
    deliveryMode: (r.delivery_mode as string | null) ?? null,
    companyRespondBy: (r.company_respond_by as string | null) ?? null,
  };
}

/**
 * ★求職者の未回答の提案（新しい順）。**画面の「未回答」と同じ条件**（段が candidate_pending）。
 * ⚠️ 求職者側専用。失敗したら null（呼び出し側は 0 と区別すること）。
 */
export async function listOpenProposals(
  candidateUserId: string,
): Promise<{ id: string; createdAt: string; respondBy: string; companyId: string }[] | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_proposals")
    .select(`id, created_at, company_id, candidate_user_id, ${PROPOSAL_PHASE_COLS}`)
    .eq("candidate_user_id", candidateUserId)
    .is("candidate_response", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[proposalEnded] 未回答の一覧:", error.message);
    return null;
  }
  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    companyId: r.company_id as string,
    candidateUserId: r.candidate_user_id as string,
    input: phaseInputOf(r),
  }));
  const visible = await visiblePairs(rows);
  return rows
    .filter((r) => proposalPhase(r.input, isVisiblePair(visible, r)) === "candidate_pending")
    .map((r) => ({ id: r.id, createdAt: r.createdAt, respondBy: r.input.respondBy, companyId: r.companyId }));
}

/** ★求職者の未回答の件数（バッジ用）。`listOpenProposals` と同じ条件。失敗したら null */
export async function countOpenProposals(candidateUserId: string): Promise<number | null> {
  return (await listOpenProposals(candidateUserId))?.length ?? null;
}
