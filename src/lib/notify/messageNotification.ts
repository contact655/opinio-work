import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★メッセージが届いたことを受信者の通知に積む（2026-09-16）。
 *
 * ── なぜ1箇所に集めるか ─────────────────────────────────────────────────────
 * 送信経路は**4本**ある（`api/dm/message` / `api/dm/bulk-message` / `api/dm/start` /
 * `api/biz/conversations/[id]/messages`）。⚠️★**呼び出し側に条件を書き写さないこと。**
 * 経路を足した人が忘れると、その経路だけ「送れるのに気づかれない」になる。
 * 通知の宛先（`lib/notify/recipients.ts`）と同じ考え方。
 *
 * ── ⚠️★なぜ作ったか ────────────────────────────────────────────────────────
 * 2026-09-16 まで**4本とも受信者に何も知らせていなかった**（通知0・メール0）。
 * DM は `/u/[id]` の「メッセージ」ボタンから**ログインしていれば誰でも送れる**のに、
 * 受け取った側は `/mypage/conversations` を自分で開くまで気づけない。
 * 2026-09-15 にヘッダーのメッセージアイコンも外したので、**気づく手段が0**になっていた。
 *
 * ── 空間 ───────────────────────────────────────────────────────────────────
 * ⚠️★**すべて `ow_users.id` 空間**（`auth.users.id` ではない）。
 *    `ow_conversation_participants.user_id` も `ow_notifications.recipient_user_id` /
 *    `actor_user_id` も `ow_users(id)` を指す（FK で確認済み）。
 *    CLAUDE.md「`auth.uid()` が返すのは `auth.users.id` で、`ow_users.id` とは別物」。
 *
 * ⚠️ best-effort。失敗してもメッセージ送信は止めない。ただし**握り潰さずログに出す**。
 */
export async function notifyNewMessage(params: {
  conversationId: string;
  /** 送った人（`ow_users.id`）。⚠️ この人自身には通知しない */
  senderOwUserId: string;
  /** ログにどの経路から来たか出す。例: "dm/message" */
  source: string;
}): Promise<void> {
  const { conversationId, senderOwUserId, source } = params;
  const admin = createAdminClient();

  /* ⚠️ `left_at` が入っている人（退出済み）には送らない。
        ⚠️ `user_id` は FK が ON DELETE SET NULL なので **null がありうる**。落とす。 */
  const { data: participants, error } = await admin
    .from("ow_conversation_participants")
    .select("user_id, left_at")
    .eq("conversation_id", conversationId);

  if (error) {
    console.error(`[notify-message:${source}] participants:`, error.message);
    return;
  }

  const recipients = (participants ?? [])
    .filter((p) => p.left_at === null)
    .map((p) => p.user_id as string | null)
    .filter((id): id is string => !!id && id !== senderOwUserId);

  if (recipients.length === 0) {
    /* ⚠️ 0件は異常ではない（自分ひとりの会話・相手が退出済み）。**黙らずに残す。** */
    console.info(`[notify-message:${source}] no recipient for conversation=${conversationId}`);
    return;
  }

  /* ⚠️★1メッセージにつき1行。**未読の集約はしない。**
        まとめると「何件届いたか」が消え、既読にしたとき古い通知まで一緒に消える。 */
  const { error: insertErr } = await admin.from("ow_notifications").insert(
    recipients.map((rid) => ({
      recipient_user_id: rid,
      actor_user_id: senderOwUserId,
      type: "message" as const,
      conversation_id: conversationId,
    })),
  );

  if (insertErr) {
    /* ⚠️ `ow_notifications_target_check` に引っかかるとここに出る（type ごとの必須が欠けている）。
          メッセージ自体は既に保存済みなので、**送信は成功のまま**にする。 */
    console.error(`[notify-message:${source}] insert:`, insertErr.message);
  }
}
