/* ★サーバー専用 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { openCompanyConversation } from "@/lib/conversations/openReason";
import { PROPOSAL_NOTE_MAX, proposalIntroLine } from "@/lib/constants/proposalResponses";
import { notifyCompanyProposalRaised } from "@/lib/notify/proposalNotification";
import { isValidDeclineReason } from "@/lib/constants/declineReasons";
import { buildForYou } from "@/lib/forYou/rank";
import { notifyOpsForYouInterest } from "@/lib/forYou/notifyOps";
import { isForYouReaction, type ForYouReaction } from "@/lib/forYou/weights";

/**
 * ★「あなたに合う順」での反応（興味あり／あとで／興味なし）を記録する。**入口はここだけ**（API はこれを呼ぶだけ）。
 *
 * 「興味あり」を**初めて**押したとき:
 *   - 担当者がいる企業 … 会話を開く（提案の「話を聞いてみたい」と同じ形。案内の行＋企業へのメール）
 *     ⚠️ 会話を作るのは `openCompanyConversation()`（openReason.ts）だけ。判定は応募と同じ `can_contact_without_stance()`
 *   - 担当者がいない企業 … 記録して、運営に1件ずつメール（notifyOps.ts）
 *   - 担当者はいるが会話の判定が通らない … 記録だけ。★理由は利用者に出さない（openReason.ts の約束）
 *
 * ⚠️★押した時点の順位とシグナルを**サーバーで計算し直して**記録する（クライアントの値を信じない）。
 *    同時に「この人の一覧にこの会社が出ているか」を確かめる（ブロック中・在籍中・掲載外の企業には押せない）。
 * ⚠️ 書くのは admin クライアントだけ（ow_for_you_reactions はクライアントに書き込みを配っていない）。
 */

export type ReactOutcome =
  | { ok: true; result: "conversation"; conversationId: string }
  | { ok: true; result: "ops_notified" }
  | { ok: true; result: "recorded" }
  | { ok: false; status: number; error: string };

export async function reactForYou(input: {
  owUserId: string;
  companyId: string;
  reaction: unknown;
  reason?: unknown;
  /** 会社へのひとこと（担当者がいる会社の「話を聞いてみたい」だけ。提案と同じ上限） */
  note?: unknown;
  /** ★「話を聞いてみたい」の取り消し。会話がまだ開いていないとき（担当者のいない会社）だけ */
  undo?: unknown;
}): Promise<ReactOutcome> {
  if (input.undo === true) return undoInterest(input.owUserId, input.companyId);
  if (!isForYouReaction(input.reaction)) return { ok: false, status: 400, error: "操作が正しくありません" };
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > PROPOSAL_NOTE_MAX) return { ok: false, status: 400, error: `ひとことは${PROPOSAL_NOTE_MAX}文字までです` };
  const reaction: ForYouReaction = input.reaction;
  let reason: string | null = null;
  if (reaction === "not_interested") {
    if (typeof input.reason !== "string" || !isValidDeclineReason("candidate", input.reason)) {
      return { ok: false, status: 400, error: "理由を1つ選んでください" };
    }
    reason = input.reason;
  }

  const list = await buildForYou(input.owUserId);
  if (!list.ok) return { ok: false, status: 500, error: list.error };
  const company = list.companies.find((c) => c.id === input.companyId);
  /* ⚠️ 一覧に出ていない会社（ブロック中・在籍中・掲載外・存在しない）は区別せず 404 */
  if (!company) return { ok: false, status: 404, error: "この会社は見つかりません" };

  const db = createAdminClient();
  const now = new Date().toISOString();
  const prev = company.reaction;
  const firstInterest = reaction === "interested" && !prev?.interestedAt;

  const { data: saved, error } = await db.from("ow_for_you_reactions").upsert({
    user_id: input.owUserId,
    company_id: input.companyId,
    reaction,
    reason,
    rank_at: company.rank,
    signals: company.signals.map((s) => ({ key: s.key, points: s.points, detail: s.detail })),
    /* ★一度入ったら消さない（会話を開く理由） */
    interested_at: prev?.interestedAt ?? (reaction === "interested" ? now : null),
    updated_at: now,
  }, { onConflict: "user_id,company_id" }).select("user_id");
  if (error || !saved || saved.length === 0) {
    console.error("[forYou/react] 記録:", error?.message ?? "0行");
    return { ok: false, status: 500, error: "記録できませんでした" };
  }

  if (reaction !== "interested") return { ok: true, result: "recorded" };
  if (!firstInterest) {
    /* 2回目以降。開いた会話があればそこへ */
    return prev?.conversationId
      ? { ok: true, result: "conversation", conversationId: prev.conversationId }
      : { ok: true, result: "recorded" };
  }

  /* ── 担当者がいない企業 → 運営へ ─────────────────────────────────────────── */
  if (!company.hasResponder) {
    /* ⚠️ 取り消してから押し直したときに二重に知らせない */
    if (prev?.opsNotifiedAt) return { ok: true, result: "ops_notified" };
    const sent = await notifyOpsForYouInterest({
      companyId: company.id, companyName: company.name, candidateUserId: input.owUserId,
      rank: company.rank, reasons: company.reasons,
    });
    if (sent) {
      const { error: nErr } = await db.from("ow_for_you_reactions")
        .update({ ops_notified_at: new Date().toISOString() })
        .eq("user_id", input.owUserId).eq("company_id", input.companyId);
      if (nErr) console.error("[forYou/react] ops_notified_at:", nErr.message);
    }
    return { ok: true, result: "ops_notified" };
  }

  /* ── 担当者がいる企業 → 会話を開く ─────────────────────────────────────────── */
  let conversationId: string;
  let isNew = false;
  try {
    const created = await openCompanyConversation({ candidateOwUserId: input.owUserId, companyId: company.id, source: "for_you" });
    /* ⚠️ 開けないときの理由は出さない（ブロック・在籍歴などを推測させない） */
    if (!created) return { ok: true, result: "recorded" };
    conversationId = created.conversationId;
    isNew = created.created;
  } catch (e) {
    console.error("[forYou/react] 会話の作成:", e);
    return { ok: true, result: "recorded" };
  }

  const { error: cErr } = await db.from("ow_for_you_reactions")
    .update({ conversation_id: conversationId })
    .eq("user_id", input.owUserId).eq("company_id", input.companyId);
  if (cErr) console.error("[forYou/react] conversation_id:", cErr.message);

  /* ⚠️ 既にあった会話（応募や面談の申込で開いていた）なら、案内の行も企業へのメールも足さない（二重に知らせない） */
  if (!isNew) return { ok: true, result: "conversation", conversationId };

  /* 案内の行（introduce.ts と同じ形。kind='proposal_intro'・送った人なし）。⚠️ 失敗しても会話はできている */
  try {
    const [{ data: cand }, { data: part, error: pErr }] = await Promise.all([
      db.from("ow_users").select("name").eq("id", input.owUserId).maybeSingle(),
      db.from("ow_conversation_participants").select("id").eq("conversation_id", conversationId)
        .eq("user_id", input.owUserId).is("left_at", null).maybeSingle(),
    ]);
    if (pErr) console.error("[forYou/react] 参加者:", pErr.message);
    const t0 = Date.now();
    const { error: iErr } = await db.from("ow_conversation_messages").insert({
      conversation_id: conversationId,
      sender_participant_id: null,
      kind: "proposal_intro",
      body: proposalIntroLine((cand?.name as string | null) ?? null),
      payload: { for_you: true },
      sent_at: new Date(t0).toISOString(),
    });
    if (iErr) console.error("[forYou/react] 案内の行:", iErr.message);
    /* ひとことがあれば、本人の発言として1通目（introduce.ts と同じ。案内の行のあとに並ぶよう1ミリ秒ずらす） */
    if (note && part?.id) {
      const { error: nErr } = await db.from("ow_conversation_messages").insert({
        conversation_id: conversationId,
        sender_participant_id: part.id as string,
        kind: "text",
        body: note,
        sent_at: new Date(t0 + 1).toISOString(),
      });
      if (nErr) console.error("[forYou/react] ひとこと:", nErr.message);
    }
    /* ★本人の操作なので未読にしない */
    if (part?.id) {
      const { error: rErr } = await db.from("ow_conversation_participants")
        .update({ last_read_at: new Date(t0 + 2).toISOString() }).eq("id", part.id as string);
      if (rErr) console.error("[forYou/react] 既読:", rErr.message);
    }
  } catch (e) {
    console.error("[forYou/react] メッセージ:", e);
  }

  await notifyCompanyProposalRaised({ companyId: company.id, candidateUserId: input.owUserId, conversationId });
  console.log(`[forYou/react] 会話を開いた company=${company.id} conversation=${conversationId}`);
  return { ok: true, result: "conversation", conversationId };
}

/**
 * ★「話を聞いてみたい」の取り消し（2026-10-15）。**会話がまだ開いていないときだけ**（担当者のいない会社）。
 *   reaction を「あとで」に戻し、interested_at を消す（会話を開く理由も消える）。
 * ⚠️ 会話が開いている（会社にプロフィールが届いた）ものは取り消せない。届いたものは戻せないため。
 * ⚠️ 運営に知らせた記録（ops_notified_at）は残す。メールは取り消せない。押し直しても二重に知らせない
 */
async function undoInterest(owUserId: string, companyId: string): Promise<ReactOutcome> {
  const db = createAdminClient();
  const { data: row, error } = await db.from("ow_for_you_reactions")
    .select("interested_at, conversation_id").eq("user_id", owUserId).eq("company_id", companyId).maybeSingle();
  if (error) {
    console.error("[forYou/react] 取り消し 取得:", error.message);
    return { ok: false, status: 500, error: "取り消せませんでした" };
  }
  if (!row?.interested_at) return { ok: false, status: 404, error: "取り消すものがありません" };
  if (row.conversation_id) return { ok: false, status: 409, error: "メッセージが始まっているため取り消せません" };
  const { data: saved, error: uErr } = await db.from("ow_for_you_reactions")
    .update({ reaction: "later", reason: null, interested_at: null, updated_at: new Date().toISOString() })
    .eq("user_id", owUserId).eq("company_id", companyId).is("conversation_id", null).select("user_id");
  if (uErr || !saved || saved.length === 0) {
    console.error("[forYou/react] 取り消し:", uErr?.message ?? "0行");
    return { ok: false, status: 500, error: "取り消せませんでした" };
  }
  return { ok: true, result: "recorded" };
}
