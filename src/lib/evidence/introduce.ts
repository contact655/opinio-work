/**
 * ★提案から会話を作る（2026-10-11 に「求職者が先に答える」形へ作り替えた）。
 *
 * いつ呼ばれるか（入口は `respond.ts` だけ。route に条件を書き写さないこと）:
 *   auto   … 求職者が「話を聞いてみたい」と答えた直後
 *   review … 企業が「会う」を押した直後
 *   運営   … /admin/proposals の再試行（作成に失敗して残ったもの）
 *
 * 会話にはこの順で入れる:
 *   ① 案内の行（`kind = 'proposal_intro'`・送った人なし）「〇〇さんが提案を見て、話を聞いてみたいと答えました。」
 *   ② ひとことがあれば、求職者本人の発言として1通目
 *
 * ⚠️★会話を作るのは `openCompanyConversation()`（`openReason.ts`）だけ。自前で ow_conversations に入れない。
 * ⚠️★二重に作らない: `introduced_at` を「まだ空なら書く」で取ってから、メッセージと通知を出す。
 * ⚠️ best-effort。失敗しても返答は取り消さない（失敗は必ずログに出し、/admin の要対応で救う）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { openCompanyConversation } from "@/lib/conversations/openReason";
import { proposalIntroLine, proposalShouldConnect } from "@/lib/constants/proposalResponses";
import { notifyCompanyProposalRaised } from "@/lib/notify/proposalNotification";

export type IntroduceOutcome =
  | { introduced: false; reason: "not_ready" | "already" | "failed" }
  | { introduced: true; conversationId: string };

/**
 * @param db ★admin クライアント（service_role）
 * @param opts.by 誰の操作で作ったか。`candidate`（求職者が答えた）・`ops`（運営の再試行）。どちらも企業にメールで知らせる。
 *   ⚠️ 2026-10-11 に `company`（企業が「会う」と答えた）をなくした。企業は答えない
 */
export async function introduceProposal(
  db: SupabaseClient,
  proposalId: string,
  opts: { by: "candidate" | "ops" },
): Promise<IntroduceOutcome> {
  const { data: row, error } = await db
    .from("ow_proposals")
    .select("candidate_user_id, company_id, candidate_response, company_response, introduced_at, candidate_note")
    .eq("id", proposalId)
    .maybeSingle();
  if (error || !row) {
    console.error("[evidence/introduce] ow_proposals:", error?.message ?? "not found", proposalId);
    return { introduced: false, reason: "failed" };
  }
  if (row.introduced_at) return { introduced: false, reason: "already" };
  if (!proposalShouldConnect({
    candidateResponse: (row.candidate_response as string | null) ?? null,
    companyResponse: (row.company_response as string | null) ?? null,
  })) return { introduced: false, reason: "not_ready" };

  const candidateUserId = row.candidate_user_id as string;
  const companyId = row.company_id as string;

  /* ① 会話を作る（作る経路は openReason.ts の1か所。判定に `can_send_scout()` が入っている）。RPC は冪等 */
  let conversationId: string;
  try {
    const created = await openCompanyConversation({ candidateOwUserId: candidateUserId, companyId, source: "proposal" });
    if (!created) return { introduced: false, reason: "failed" };
    conversationId = created.conversationId;
  } catch (e) {
    console.error("[evidence/introduce] 会話の作成:", e);
    return { introduced: false, reason: "failed" };
  }

  /* ② 取る。⚠️ 0行なら別の処理が先に作った（メッセージと通知を二重に出さない） */
  const { data: claimed, error: cErr } = await db
    .from("ow_proposals")
    .update({ conversation_id: conversationId, introduced_at: new Date().toISOString() })
    .eq("id", proposalId)
    .is("introduced_at", null)
    .select("id");
  if (cErr) {
    console.error("[evidence/introduce] 記録:", cErr.message);
    return { introduced: false, reason: "failed" };
  }
  if (!claimed || claimed.length === 0) return { introduced: false, reason: "already" };

  /* ③ 案内の行とひとこと。⚠️ 失敗しても会話はできている（ログを出して進む） */
  try {
    const [{ data: cand }, { data: part, error: pErr }] = await Promise.all([
      db.from("ow_users").select("name").eq("id", candidateUserId).maybeSingle(),
      db.from("ow_conversation_participants").select("id").eq("conversation_id", conversationId)
        .eq("user_id", candidateUserId).is("left_at", null).maybeSingle(),
    ]);
    if (pErr) console.error("[evidence/introduce] 参加者:", pErr.message);
    const t0 = Date.now();
    const { error: iErr } = await db.from("ow_conversation_messages").insert({
      conversation_id: conversationId,
      sender_participant_id: null,
      kind: "proposal_intro",
      body: proposalIntroLine((cand?.name as string | null) ?? null),
      payload: { proposal_id: proposalId },
      sent_at: new Date(t0).toISOString(),
    });
    if (iErr) console.error("[evidence/introduce] 案内の行:", iErr.message);
    const note = ((row.candidate_note as string | null) ?? "").trim();
    if (note && part?.id) {
      /* ⚠️ 案内の行のあとに並ぶよう、時刻を1ミリ秒ずらす */
      const { error: nErr } = await db.from("ow_conversation_messages").insert({
        conversation_id: conversationId,
        sender_participant_id: part.id as string,
        kind: "text",
        body: note,
        sent_at: new Date(t0 + 1).toISOString(),
      });
      if (nErr) console.error("[evidence/introduce] ひとこと:", nErr.message);
    }
    /* ★求職者には自分の操作なので未読にしない（案内の行は送った人が無いので、放っておくと未読に数えられる） */
    if (part?.id && opts.by === "candidate") {
      const { error: rErr } = await db.from("ow_conversation_participants")
        .update({ last_read_at: new Date(t0 + 2).toISOString() }).eq("id", part.id as string);
      if (rErr) console.error("[evidence/introduce] 既読:", rErr.message);
    }
  } catch (e) {
    console.error("[evidence/introduce] メッセージ:", e);
  }

  /* ④ 知らせる。⚠️ 記録を書いたあと（二重に出さない） */
  await notifyCompanyProposalRaised({ companyId, candidateUserId, mode: "auto", conversationId });
  /* ⚠️ 求職者への「〇〇から会いたいと返事が届きました」（ベル・メール）は 2026-10-11 に外した（企業が答えないため） */

  console.log(`[evidence/introduce] 会話を作った proposal=${proposalId} conversation=${conversationId} by=${opts.by}`);
  return { introduced: true, conversationId };
}
