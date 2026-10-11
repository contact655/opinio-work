import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify/email";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { proposalRaisedCompanyTemplate } from "@/lib/notify/templates";

/**
 * ★提案（②）と紹介（③）を候補者のベルに出す（2026-09-21）。
 *
 * ── ⚠️★なぜ作ったか ────────────────────────────────────────────────────────
 * 2026-09-21 まで、**提案が届いても紹介が成立しても誰にも知らせていなかった。**
 * 画面への導線も0件だったので、**誰も答えようがなく mutual は起こせなかった**
 * （CLAUDE.md「起きなかった0か、起こせなかった0かを分ける」）。
 *
 * ── ★企業にはメールで知らせる（2026-10-11 に変えた）─────────────────────────────
 * 提案を「求職者が先に答える」形にしたので、企業に知らせるのは**求職者が「話を聞いてみたい」と
 * 答えたときだけ**（`notifyCompanyProposalRaised`）。未回答・見送りでは何も送らない。
 * ⚠️ 以前ここには「企業向けメールを生やさないこと（宛先の無い企業が多く運営に落ちる）」と書いてあった。
 *    提案は**有効な担当者がいる企業にしか作らない**（`generate.ts`）ので、宛先は担当者に届く。
 *    宛先の決め方は応募の通知と同じ（`getCompanyNotificationTarget`）。
 *
 * ── 空間 ───────────────────────────────────────────────────────────────────
 * ⚠️★`ow_notifications.recipient_user_id` も `ow_proposals.candidate_user_id` も
 *    **`ow_users.id` 空間**（`auth.users.id` ではない）。
 *
 * ⚠️ どちらも best-effort。失敗しても提案の作成・返答は止めない。
 *    ただし**握り潰さずログに出す**。
 */

/**
 * 提案が届いたことを知らせる（②）。**新しく作った行だけ**を渡すこと。
 *
 * ⚠️★既存の提案を渡さない。`generate.ts` は `on conflict do nothing` なので
 *    `.select()` に返るのは**新規だけ**で、そのまま渡せば二重に知らせない。
 */
export async function notifyProposalsCreated(
  proposals: { id: string; candidateUserId: string; companyId: string }[],
): Promise<void> {
  if (proposals.length === 0) return;
  const admin = createAdminClient();

  /* ⚠️★1提案につき1行。**まとめない。**「何件届いたか」が消え、
        既読にしたとき古い通知まで一緒に消える（メッセージ通知と同じ理由）。 */
  const { error } = await admin.from("ow_notifications").insert(
    proposals.map((p) => ({
      recipient_user_id: p.candidateUserId,
      /* ★送り主は企業。⚠️ `actor_user_id` は入れない（人ではない） */
      actor_company_id: p.companyId,
      type: "proposal" as const,
      proposal_id: p.id,
    })),
  );

  if (error) {
    /* ⚠️ `ow_notifications_target_check` に引っかかるとここに出る。
          提案自体は保存済みなので、**作成は成功のまま**にする。 */
    console.error("[notify-proposal] insert:", error.message);
    return;
  }
  console.log(`[notify-proposal] ${proposals.length}件`);
}

/**
 * 双方合意して話せるようになったことを知らせる（③）。
 *
 * ⚠️★**`proposal` とは別の種別にしている。** 押したときの行き先が違う
 *    （提案は `/mypage/proposals`、紹介は会話そのもの）。1つで兼ねない。
 *
 * ⚠️ 企業側には出ない（上の注記）。**企業は `/biz/proposals` で「会いたい」を
 *    押した本人なので、次に何が起きるかは知っている。**
 */
export async function notifyIntroduction(params: {
  proposalId: string;
  /** ★`ow_users.id` 空間 */
  candidateUserId: string;
  companyId: string;
  conversationId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("ow_notifications").insert({
    recipient_user_id: params.candidateUserId,
    actor_company_id: params.companyId,
    type: "introduction" as const,
    proposal_id: params.proposalId,
    conversation_id: params.conversationId,
  });

  if (error) {
    console.error("[notify-introduction] insert:", error.message);
    return;
  }
  console.log(`[notify-introduction] proposal=${params.proposalId}`);
}

/**
 * ★求職者が提案を見て「話を聞いてみたい」と答えたことを、企業に知らせる（2026-10-11）。
 *   auto … 会話を作ったあとに呼ぶ（「メッセージを開く」） ／ review … 答えた直後に呼ぶ（「提案を見る」）
 * ⚠️★ひとことの中身は書かない（名前とリンクだけ）。⚠️ best-effort。失敗はログに出す
 */
export async function notifyCompanyProposalRaised(params: {
  companyId: string;
  /** ★`ow_users.id` 空間 */
  candidateUserId: string;
  mode: "auto" | "review";
  conversationId: string | null;
}): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: cand, error } = await db.from("ow_users").select("name").eq("id", params.candidateUserId).maybeSingle();
    if (error) console.error("[notify-proposal-raised] ow_users:", error.message);
    const target = await getCompanyNotificationTarget(params.companyId, "proposal-raised");
    for (const to of target.to) {
      await notify(proposalRaisedCompanyTemplate({
        to,
        candidateName: (cand?.name as string | null) ?? null,
        mode: params.mode,
        conversationId: params.conversationId,
        viaOps: target.viaOps,
      }));
    }
  } catch (e) {
    console.error("[notify-proposal-raised]", e instanceof Error ? e.message : e);
  }
}
