/* ★サーバー専用 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROPOSAL_NOTE_MAX } from "@/lib/constants/proposalResponses";
import { isValidDeclineReason } from "@/lib/constants/declineReasons";
import { buildForYou } from "@/lib/forYou/rank";
import { expressInterest } from "@/lib/interest/server";
import { isForYouReaction, type ForYouReaction } from "@/lib/forYou/weights";

/**
 * ★「あなたに合う順」での反応（興味あり／あとで／興味なし）を記録する。**入口はここだけ**（API はこれを呼ぶだけ）。
 *
 * 「興味あり」を**初めて**押したとき:
 *   - 担当者がいる企業 … 会話を開く（提案の「話を聞いてみたい」と同じ形。案内の行＋企業へのメール）
 *     ⚠️ 会話を作るのは `openCompanyConversation()`（openReason.ts）だけ。判定は応募と同じ `can_contact_without_stance()`
 *   - 担当者がいない企業 … 受け付けない（409。画面には「保存」を出している。2026-10-27 / 柴さんの決定）
 *   - 担当者はいるが会話の判定が通らない … 記録だけ。★理由は利用者に出さない（openReason.ts の約束）
 *
 * ⚠️★押した時点の順位とシグナルを**サーバーで計算し直して**記録する（クライアントの値を信じない）。
 *    同時に「この人の一覧にこの会社が出ているか」を確かめる（ブロック中・在籍中・掲載外の企業には押せない）。
 * ⚠️ 書くのは admin クライアントだけ（ow_for_you_reactions はクライアントに書き込みを配っていない）。
 */

export type ReactOutcome =
  | { ok: true; result: "conversation"; conversationId: string }
  | { ok: true; result: "recorded" }
  | { ok: false; status: number; error: string };

export async function reactForYou(input: {
  owUserId: string;
  companyId: string;
  reaction: unknown;
  reason?: unknown;
  /** 会社へのひとこと（担当者がいる会社の「話を聞いてみたい」だけ。提案と同じ上限） */
  note?: unknown;
  /** 押すときに見せた確認の文言の版（lib/interest/constants.ts の INTEREST_CONSENT_VERSION） */
  consentVersion?: unknown;
  /** ★「話を聞いてみたい」の取り消し。会話がまだ開いていないとき（担当者のいない会社）だけ */
  undo?: unknown;
  /** ★「あとで」を外す（2026-10-23）。何も押していない状態に戻す */
  clear?: unknown;
}): Promise<ReactOutcome> {
  if (input.undo === true) return undoInterest(input.owUserId, input.companyId);
  if (input.clear === true) return clearReaction(input.owUserId, input.companyId);
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

  /* ★「話を聞いてみたい」は lib/interest/server.ts の1か所で記録して届ける（企業ページ・上段の提案と同じ。2026-10-27） */
  if (reaction === "interested") {
    const r = await expressInterest({
      owUserId: input.owUserId,
      companyId: input.companyId,
      source: "for_you",
      note: input.note,
      consentVersion: input.consentVersion,
      rank: company.rank,
      signals: company.signals.map((s) => ({ key: s.key, points: s.points, detail: s.detail })),
      reasons: company.reasons,
    });
    if (!r.ok) return r;
    return r.conversationId
      ? { ok: true, result: "conversation", conversationId: r.conversationId }
      : { ok: true, result: "recorded" };
  }

  const db = createAdminClient();
  const now = new Date().toISOString();
  const prev = company.reaction;
  const { data: saved, error } = await db.from("ow_for_you_reactions").upsert({
    user_id: input.owUserId,
    company_id: input.companyId,
    reaction,
    reason,
    rank_at: company.rank,
    signals: company.signals.map((s) => ({ key: s.key, points: s.points, detail: s.detail })),
    /* ★一度入ったら消さない（会話を開く理由） */
    interested_at: prev?.interestedAt ?? null,
    updated_at: now,
  }, { onConflict: "user_id,company_id" }).select("user_id");
  if (error || !saved || saved.length === 0) {
    console.error("[forYou/react] 記録:", error?.message ?? "0行");
    return { ok: false, status: 500, error: "記録できませんでした" };
  }
  return { ok: true, result: "recorded" };
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
  /* ★取り消したら「何も押していない」に戻す（2026-10-23 / 柴さんの指示）。
        それまでは reaction を later にしていて、本人が押していない「あとで」が付いていた */
  const { data: saved, error: uErr } = await db.from("ow_for_you_reactions")
    .delete().eq("user_id", owUserId).eq("company_id", companyId).is("conversation_id", null).select("user_id");
  if (uErr || !saved || saved.length === 0) {
    console.error("[forYou/react] 取り消し:", uErr?.message ?? "0行");
    return { ok: false, status: 500, error: "取り消せませんでした" };
  }
  return { ok: true, result: "recorded" };
}

/** ★「あとで」を外す（2026-10-23）。「あとで」以外（気になる・興味なし・会話あり）には触らない */
async function clearReaction(owUserId: string, companyId: string): Promise<ReactOutcome> {
  const db = createAdminClient();
  const { data: saved, error } = await db.from("ow_for_you_reactions")
    .delete().eq("user_id", owUserId).eq("company_id", companyId).eq("reaction", "later")
    .is("interested_at", null).is("conversation_id", null).select("user_id");
  if (error) {
    console.error("[forYou/react] あとでを外す:", error.message);
    return { ok: false, status: 500, error: "外せませんでした" };
  }
  if (!saved || saved.length === 0) return { ok: false, status: 404, error: "外すものがありません" };
  return { ok: true, result: "recorded" };
}
