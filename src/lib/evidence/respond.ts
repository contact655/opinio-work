/**
 * 提案への返答（2026-10-11 に「求職者が先に答える」形へ作り替えた）。
 *
 *   求職者 … `saveCandidateResponse`：「話を聞いてみたい」（任意のひとこと）／「今回は見送る」（理由は任意）
 *   企業   … `saveCompanyResponse`：review で届いた方に「会う」／「今回は見送る」（理由は任意）
 *
 * ⚠️★会話を作るのは `introduceProposal()`（introduce.ts）だけ。route に条件を書き写さないこと。
 * ⚠️★段の判定は `proposalPhase()` の1か所。答えられるのは
 *    求職者 … candidate_pending のときだけ ／ 企業 … company_review のときだけ（`getCompanyProposalForResponse`）。
 * ⚠️★見送り理由は相手に渡さない。`ow_proposal_declines` は運営しか読めない表。
 *    理由は任意（2026-10-11 / 柴さんの判断）。選ばなかったら行を作らない（空を既定値で埋めない）。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { introduceProposal } from "./introduce";
import { mutateOne } from "@/lib/supabase/mutate";
import { PROPOSAL_PHASE_COLS, phaseInputOf, visiblePairs, isVisiblePair } from "./proposalEnded";
import { getCompanyProposalForResponse, getCompanyProposalMode } from "./companyProposals";
import { notifyCompanyProposalRaised } from "@/lib/notify/proposalNotification";
import {
  PROPOSAL_COMPANY_RESPONSE_DAYS, PROPOSAL_NOTE_MAX, proposalPhase,
  type CandidateResponse, type CompanyResponse,
} from "@/lib/constants/proposalResponses";
import { DECLINE_NOTE_MAX, isValidDeclineReason, type DeclineSide } from "@/lib/constants/declineReasons";

export type RespondOutcome = { ok: true; conversationId?: string | null } | { ok: false; status: number; error: string };

/** 見送り理由（任意）を保存する。⚠️ 選ばなかったら何もしない */
async function saveDecline(proposalId: string, side: DeclineSide, reason: string | null | undefined, note: string | null | undefined): Promise<RespondOutcome | null> {
  const r = (reason ?? "").trim();
  const n = (note ?? "").trim();
  if (!r) return null;
  if (!isValidDeclineReason(side, r)) return { ok: false, status: 400, error: "この選択肢は使えません" };
  if (n.length > DECLINE_NOTE_MAX) return { ok: false, status: 400, error: `メモは${DECLINE_NOTE_MAX}文字までです` };
  const { error } = await createAdminClient().from("ow_proposal_declines").upsert(
    { proposal_id: proposalId, side, reason: r, note: n || null },
    { onConflict: "proposal_id,side" },
  );
  if (error) {
    console.error("[evidence/respond] declines:", error.message);
    return { ok: false, status: 500, error: "見送り理由の保存に失敗しました" };
  }
  return null;
}

/** 理由とメモの事前チェック（保存前に弾く） */
function checkDeclineInput(side: DeclineSide, reason?: string | null, note?: string | null): RespondOutcome | null {
  const r = (reason ?? "").trim();
  if (r && !isValidDeclineReason(side, r)) return { ok: false, status: 400, error: "この選択肢は使えません" };
  if ((note ?? "").trim().length > DECLINE_NOTE_MAX) return { ok: false, status: 400, error: `メモは${DECLINE_NOTE_MAX}文字までです` };
  return null;
}

/**
 * ★求職者の返答。⚠️ 本人の提案かは `candidateUserId` で絞って確かめる（route がセッションから渡す）。
 */
export async function saveCandidateResponse(input: {
  proposalId: string;
  candidateUserId: string;
  response: CandidateResponse;
  /** 「会社へのひとこと」（interested のときだけ・200字まで） */
  note?: string | null;
  reason?: string | null;
  declineNote?: string | null;
}): Promise<RespondOutcome> {
  const db = createAdminClient();
  const note = (input.note ?? "").trim();
  if (input.response === "interested" && note.length > PROPOSAL_NOTE_MAX) {
    return { ok: false, status: 400, error: `ひとことは${PROPOSAL_NOTE_MAX}文字までです` };
  }
  if (input.response === "declined") {
    const bad = checkDeclineInput("candidate", input.reason, input.declineNote);
    if (bad) return bad;
  }

  const { data: cur, error } = await db.from("ow_proposals")
    .select(`id, company_id, candidate_user_id, ${PROPOSAL_PHASE_COLS}`)
    .eq("id", input.proposalId).eq("candidate_user_id", input.candidateUserId).maybeSingle();
  if (error) {
    console.error("[evidence/respond] ow_proposals:", error.message);
    return { ok: false, status: 500, error: "提案を取得できませんでした" };
  }
  if (!cur) return { ok: false, status: 404, error: "提案が見つかりません" };
  if (cur.candidate_response) return { ok: false, status: 409, error: "この提案にはすでに答えています" };
  const companyId = cur.company_id as string;
  const pair = { companyId, candidateUserId: input.candidateUserId };
  const visible = isVisiblePair(await visiblePairs([pair]), pair);
  if (proposalPhase(phaseInputOf(cur), visible) !== "candidate_pending") {
    /* ⚠️ 終了の理由は返さない */
    return { ok: false, status: 409, error: "この提案は終了しました" };
  }

  const now = new Date();
  if (input.response === "declined") {
    const r = await mutateOne(
      db.from("ow_proposals").update({ candidate_response: "declined", candidate_responded_at: now.toISOString() })
        .eq("id", input.proposalId).is("candidate_response", null),
      "proposal candidate declined",
    );
    if (!r.ok) return { ok: false, status: r.status, error: r.error };
    const d = await saveDecline(input.proposalId, "candidate", input.reason, input.declineNote);
    if (d) return d;
    return { ok: true };
  }

  /* ★「話を聞いてみたい」。企業の設定を写す。
        ⚠️ 移行前に企業が「会いたい」と答え済みなら auto（求職者が答えたらすぐ会話）。
        ⚠️ 設定を読めなかったら review に倒す（自動で会話を作らない側） */
  const mode = cur.company_response === "want_to_meet" ? "auto" : ((await getCompanyProposalMode(companyId)) ?? "review");
  const r = await mutateOne(
    db.from("ow_proposals").update({
      candidate_response: "interested",
      candidate_responded_at: now.toISOString(),
      candidate_note: note || null,
      delivery_mode: mode,
      company_respond_by: mode === "review" ? new Date(now.getTime() + PROPOSAL_COMPANY_RESPONSE_DAYS * 24 * 60 * 60 * 1000).toISOString() : null,
    }).eq("id", input.proposalId).is("candidate_response", null),
    "proposal candidate interested",
  );
  if (!r.ok) return { ok: false, status: r.status, error: r.error };

  if (mode === "auto") {
    const out = await introduceProposal(db, input.proposalId, { by: "candidate" });
    return { ok: true, conversationId: out.introduced ? out.conversationId : null };
  }
  await notifyCompanyProposalRaised({ companyId, candidateUserId: input.candidateUserId, mode: "review", conversationId: null });
  return { ok: true, conversationId: null };
}

/**
 * ★企業の返答（review のときだけ）。
 * ⚠️★答えられない提案（未回答・見送り・期限切れ・auto・他社・存在しない）は一律 404「見つかりません」。
 *    存在を区別させない。
 */
export async function saveCompanyResponse(input: {
  proposalId: string;
  companyId: string;
  response: CompanyResponse;
  reason?: string | null;
  note?: string | null;
}): Promise<RespondOutcome> {
  const notFound: RespondOutcome = { ok: false, status: 404, error: "提案が見つかりません" };
  if (input.response === "declined") {
    const bad = checkDeclineInput("company", input.reason, input.note);
    if (bad) return bad;
  }
  const row = await getCompanyProposalForResponse(input.companyId, input.proposalId);
  if (!row) return notFound;

  const db = createAdminClient();
  const r = await mutateOne(
    db.from("ow_proposals").update({ company_response: input.response, company_responded_at: new Date().toISOString() })
      .eq("id", input.proposalId).eq("company_id", input.companyId).is("company_response", null),
    "proposal company response",
  );
  if (!r.ok) return r.status === 404 ? notFound : { ok: false, status: r.status, error: r.error };

  if (input.response === "declined") {
    const d = await saveDecline(input.proposalId, "company", input.reason, input.note);
    if (d) return d;
    return { ok: true };
  }
  const out = await introduceProposal(db, input.proposalId, { by: "company" });
  return { ok: true, conversationId: out.introduced ? out.conversationId : null };
}
