import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★提案（②）と紹介（③）を候補者のベルに出す（2026-09-21）。
 *
 * ── ⚠️★なぜ作ったか ────────────────────────────────────────────────────────
 * 2026-09-21 まで、**提案が届いても紹介が成立しても誰にも知らせていなかった。**
 * 画面への導線も0件だったので、**誰も答えようがなく mutual は起こせなかった**
 * （CLAUDE.md「起きなかった0か、起こせなかった0かを分ける」）。
 *
 * ── ⚠️★受け取るのは候補者だけ ─────────────────────────────────────────────
 * `/biz` には通知の面が**1つも無い**（実測 2026-09-21: `ow_notifications` も
 * `NotificationBell` も `src/app/biz` からの参照0件）。企業はナビの「提案」から
 * 自分で見に行く。**ここから企業向けのメールを生やさないこと** ——
 * 掲載22社のうち通知の宛先を持つのは2社で、残りは運営フォールバックで
 * `ADMIN_EMAIL` に落ちる（＝運営に大量に届く）。出すなら宛先の設計とセット。
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
