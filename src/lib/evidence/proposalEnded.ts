/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 提案が「終了した」か（2026-10-09 / 柴さんの判断）。
 *
 * ★終了の条件（見る側から見て）:
 *   ① **相手が見送った**（企業から見れば候補者が、候補者から見れば企業が）
 *   ② **いまはこの企業にこの候補者を見せてはいけない**（`can_send_scout()` が false。
 *      本人が「今は考えていない」に変えた・ブロックした・在籍が判明した等）
 *   ③ ★**回答の締め切り（`respond_by`。届いてから30日）を過ぎて、両方の回答がそろっていない**（2026-10-10）
 *   ただし**双方合意で紹介済み**（`introduced_at` あり）のものは終了にしない（会話が既にある）。
 *   ⚠️ 締め切りは**表示するときに判定する**（定期実行で状態を書き換えない）。
 *
 * ⚠️★**終了の理由はどの画面にも出さない。** 画面に渡すのは「終了したか」の真偽だけ。
 *    相手が見送ったことを直接伝えないために、②も同じ「終了」に混ぜてある
 *    （理由が1つだと「終わった＝相手が見送った」と読めてしまう）。
 * ⚠️★**判定をここ以外に書き写さないこと。** 使うのは
 *    `/biz/proposals`・`/mypage/proposals`・両方の未回答バッジ・返答の API（`respond.ts`）。
 *    割れると「画面では終わっているのにバッジに数えられる」「画面では押せないのに API は通る」になる。
 * ⚠️ 自分が見送った提案は「終了」ではなく、**自分の答え**として表示する（呼び出し側）。
 */

export type ProposalSide = "candidate" | "company";

export type ProposalForEnd = {
  companyId: string;
  /** ow_users 空間 */
  candidateUserId: string;
  candidateResponse: string | null;
  companyResponse: string | null;
  introducedAt: string | null;
  /** ★回答の締め切り（`ow_proposals.respond_by`）。⚠️ 必須。select から落とすと締め切りが効かなくなるので型で止める */
  respondBy: string;
};

/** ★提案に答えられる日数（届いてから）。⚠️ DB の既定値（`now() + interval '30 days'`）と同じ値にすること */
export const PROPOSAL_RESPONSE_DAYS = 30;

/** 締め切りを過ぎたか */
export function isProposalExpired(p: Pick<ProposalForEnd, "respondBy">, now = new Date()): boolean {
  return new Date(p.respondBy).getTime() <= now.getTime();
}

/** 締め切りまで「あと◯日」（切り上げ。過ぎていれば 0） */
export function proposalDaysLeft(respondBy: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(respondBy).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

const pairKey = (companyId: string, candidateUserId: string) => `${companyId}:${candidateUserId}`;

/**
 * いま見せてよい（企業 × 候補者）の組を返す。⚠️ 判定は `can_send_scout()` そのもの。
 * ⚠️ 失敗したら**見せない側**（＝終了）に倒す。黙らずログを出す。
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

/** 見る側（`side`）から見て、この提案が終了しているか */
export function isProposalEndedFor(side: ProposalSide, p: ProposalForEnd, visible: boolean): boolean {
  if (p.introducedAt) return false;
  const otherDeclined = side === "company" ? p.candidateResponse === "declined" : p.companyResponse === "declined";
  const expired = isProposalExpired(p) && !(p.candidateResponse && p.companyResponse);
  return otherDeclined || !visible || expired;
}

/**
 * ★未回答の提案（新しい順）。**画面の「未回答」と同じ条件**:
 *   自分がまだ答えておらず、終了してもいないもの。
 * ⚠️ 返すのは id と作成日時だけ（企業側のホームで使う。⚠️ 候補者は匿名なので名前を返さない）。
 * ⚠️ 失敗したら null（呼び出し側は 0 と区別すること。「0 = 無い」とは限らない）。
 */
export async function listOpenProposals(
  side: ProposalSide,
  id: { companyId: string } | { candidateUserId: string },
): Promise<{ id: string; createdAt: string; respondBy: string }[] | null> {
  const db = createAdminClient();
  let q = db
    .from("ow_proposals")
    .select("id, created_at, respond_by, company_id, candidate_user_id, candidate_response, company_response, introduced_at");
  q = side === "company"
    ? q.eq("company_id", (id as { companyId: string }).companyId).is("company_response", null)
    : q.eq("candidate_user_id", (id as { candidateUserId: string }).candidateUserId).is("candidate_response", null);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) {
    console.error("[proposalEnded] 未回答の一覧:", error.message);
    return null;
  }
  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    companyId: r.company_id as string,
    candidateUserId: r.candidate_user_id as string,
    candidateResponse: (r.candidate_response as string | null) ?? null,
    companyResponse: (r.company_response as string | null) ?? null,
    introducedAt: (r.introduced_at as string | null) ?? null,
    respondBy: r.respond_by as string,
  }));
  const visible = await visiblePairs(rows);
  return rows.filter((r) => !isProposalEndedFor(side, r, isVisiblePair(visible, r)))
    .map((r) => ({ id: r.id, createdAt: r.createdAt, respondBy: r.respondBy }));
}

/** ★未回答の提案の件数（バッジ用）。`listOpenProposals` と同じ条件。失敗したら null */
export async function countOpenProposals(
  side: ProposalSide,
  id: { companyId: string } | { candidateUserId: string },
): Promise<number | null> {
  return (await listOpenProposals(side, id))?.length ?? null;
}
