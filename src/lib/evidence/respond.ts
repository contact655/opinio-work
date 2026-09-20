/**
 * 提案への返答と、見送り理由の保存（②⑨④の共通部分）。
 *
 * ⚠️★**②と⑨で別実装にしないこと。** 違うのは「どちらの side か」だけ。
 *
 * ⚠️★**③（双方合意の紹介）もここから呼ぶ。** 返答を保存したあとに
 *    [`introduceIfMutual()`](./introduce.ts) を通す。**route 側に書かないこと。**
 *
 * ⚠️★**求職者の見送り理由は企業に渡さない。企業の理由は要約のみ求職者に渡す。**
 *    2026-09-18 時点では**どちらも相手に渡していない**（保存までしか作っていない）。
 *    担保は `ow_proposal_declines` を別表にして RLS で side を絞っていること。
 *    **ここで相手側の行を読まないこと。**
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { introduceIfMutual } from "./introduce";
import { mutateOne } from "@/lib/supabase/mutate";
import {
  DECLINE_NOTE_MAX,
  isValidDeclineReason,
  type DeclineSide,
} from "@/lib/constants/declineReasons";

export type RespondInput = {
  proposalId: string;
  side: DeclineSide;
  /** `interested` / `declined`（求職者）または `want_to_meet` / `declined`（企業） */
  response: string;
  /** 見送るときだけ必須 */
  reason?: string | null;
  note?: string | null;
};

export type RespondOutcome = { ok: true } | { ok: false; status: number; error: string };

export async function saveProposalResponse(input: RespondInput): Promise<RespondOutcome> {
  const { proposalId, side, response } = input;
  const db = createAdminClient();

  const isDecline = response === "declined";
  if (isDecline) {
    const reason = (input.reason ?? "").trim();
    /* ⚠️ 理由は1つだけ。**空を既定値で埋めない**（「その他」に倒すと集計が濁る） */
    if (!reason) return { ok: false, status: 400, error: "見送る理由を選んでください" };
    if (!isValidDeclineReason(side, reason)) {
      /* ★side が違う選択肢は弾く。DB の CHECK も同じことを要求している（2層） */
      return { ok: false, status: 400, error: "この選択肢はこちら側では使えません" };
    }
    if ((input.note ?? "").length > DECLINE_NOTE_MAX) {
      return { ok: false, status: 400, error: `メモは${DECLINE_NOTE_MAX}文字までです` };
    }
  }

  const now = new Date().toISOString();
  const patch =
    side === "candidate"
      ? { candidate_response: response, candidate_responded_at: now }
      : { company_response: response, company_responded_at: now };

  /* ⚠️ `mutateOne`。0行更新を成功として扱わない（CLAUDE.md）。
        提案が消えている／id が違うときにここで気づける。 */
  const r = await mutateOne(
    db.from("ow_proposals").update(patch).eq("id", proposalId),
    `proposal ${side} response`,
  );
  if (!r.ok) return { ok: false, status: r.status, error: r.error };

  if (isDecline) {
    /* ⚠️ 1提案 × 1side につき1件（DB の unique）。押し直しは上書きにする */
    const { error } = await db
      .from("ow_proposal_declines")
      .upsert(
        {
          proposal_id: proposalId,
          side,
          reason: (input.reason ?? "").trim(),
          note: (input.note ?? "").trim() || null,
        },
        { onConflict: "proposal_id,side" },
      );
    if (error) {
      console.error("[evidence/respond] declines:", error.message);
      return { ok: false, status: 500, error: "見送り理由の保存に失敗しました" };
    }
  }

  /* ── ③ 双方合意の紹介 ──────────────────────────────────────────────────
     ⚠️★**ここが唯一の入口。** ②の route と⑨の route に条件を書き写さないこと。
        どちらが「最後に答えたほう」でも同じ経路を通る。
     ⚠️ best-effort。紹介に失敗しても返答は取り消さない（中は握りつぶさずログを出す）。
     ⚠️ 見送りのときは呼ばない —— `proposalStage()` が `closed` を返すので
        呼んでも no-op だが、**無駄な往復を1本減らす**。 */
  if (!isDecline) {
    await introduceIfMutual(db, proposalId);
  }

  return { ok: true };
}
