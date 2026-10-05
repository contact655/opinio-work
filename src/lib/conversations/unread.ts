import { createAdminClient } from "@/lib/supabase/admin";

/**
 * メッセージの未読判定。**サイドバーのバッジと一覧のドットが同じ式を見る。**
 *
 * ── なぜ1箇所に置くか（2026-09-20 / 柴さんの指示）────────────────────────────
 * 2026-09-20 まで、2つは**別の式**だった。
 *
 *   | どこ | 何を数えていたか |
 *   |---|---|
 *   | `/mypage` サイドバー | `last_message_at > 7日前` の会話数（**未読ではない**） |
 *   | `/mypage/conversations` のドット | `sent_at > last_read_at` かつ 送信者が自分でない |
 *
 * 前者は「7日以内に動きがあったか」で、**読んでいても数えられ、8日前の未読は数えられない。**
 * 数え方が割れていると、バッジの数字を信じて開いた人が何も見つけられない。
 *
 * ⚠️★**参加者行（`ow_conversation_participants`）が唯一の可視性の軸。**
 *    `ow_conversations.candidate_user_id` / `partner_user_id` で絞らないこと。
 *    あれは「誰の会話か」であって「誰が読んでよいか」ではなく、
 *    企業担当者は参加者行でしか会話に繋がらない。
 *    ⚠️ 2026-08-25 に、バッジだけが `candidate_user_id` で数えていたせいで
 *       **参加者行の無い会話を数え、押すと「まだ対話がありません」に着く**状態が出ている。
 *
 * ⚠️★**`ow_message_reads` は使わないこと。** 本番0行・src 参照0件で、
 *    ポリシーが user_id の空間を取り違えていて誰も読み書きできない。
 *
 * ★企業側も 2026-09-21 から `last_read_at` を書く（`/biz/conversations/[id]` を開いたとき）。
 *   企業側のバッジと一覧のドットは `unreadConversationIds(..., { companyId })` を使う。
 *   ⚠️ **参加者でない会話は数えない。** 企業の担当者は「参加する」を押すまで
 *      メッセージ自体を読めない（RLS）ので、未読と言っても開いて読めない。
 */

/** ⚠️ `user_id` は **`ow_users.id`**（`auth.uid()` ではない）。参加者行も通知も ow_users 空間 */
export type UnreadCount = { conversations: number };

/**
 * 未読のある会話の数（**通数ではない**）。
 *
 * ── なぜ「会話数」か（2026-09-20 / 柴さんの判断・案A）──────────────────────
 * 一覧のドットと**同じ粒度**になるため。通数にすると「バッジ3・ドット1」のように
 * 画面のあいだで意味がずれる。通数が要るなら、ドット側も数字に変えてから。
 *
 * ⚠️ 0 のときは 0 を返す。呼び出し側が「0 なら出さない」を決める
 *    （ここで null を返すと「取得に失敗した」と区別が付かない）。
 * ⚠️ 失敗しても 0 を返すが、**握り潰さずログに出す。**
 *    ここを throw にすると `/mypage` 全体が落ちる（バッジは主役ではない）。
 */
export async function countUnreadConversations(owUserId: string): Promise<number> {
  return (await unreadConversationIds(owUserId)).size;
}

/**
 * 未読のある会話の id。⚠️ 失敗したら空集合を返す（ログは出す）。
 *
 * `companyId` を渡すと**その企業の会話だけ**に絞る（企業側のバッジ用。2026-09-21）。
 * ⚠️★企業側では必ず渡すこと。同じ人が求職者としても会話を持っていると、
 *    渡さなければそちらまで企業のバッジに数えてしまう。
 */
export async function unreadConversationIds(
  owUserId: string,
  opts: { companyId?: string } = {},
): Promise<Set<string>> {
  const admin = createAdminClient();
  const result = new Set<string>();

  /* ① 自分の参加者行。**ここが可視性の絞り込み**（RLS には任せない。admin なので効かない） */
  const { data: allParts, error: partErr } = await admin
    .from("ow_conversation_participants")
    .select("id, conversation_id, last_read_at")
    .eq("user_id", owUserId);
  if (partErr) {
    console.error("[unread] 参加者の取得に失敗:", partErr.message);
    return result;
  }
  let parts = allParts ?? [];
  if (parts.length === 0) return result;

  if (opts.companyId) {
    const { data: convs, error: convErr } = await admin
      .from("ow_conversations")
      .select("id")
      .in("id", parts.map((p) => p.conversation_id as string))
      .eq("company_id", opts.companyId);
    if (convErr) {
      console.error("[unread] 会話の取得に失敗:", convErr.message);
      return result;
    }
    const ok = new Set((convs ?? []).map((c) => c.id as string));
    parts = parts.filter((p) => ok.has(p.conversation_id as string));
    if (parts.length === 0) return result;
  }

  const convIds = parts.map((p) => p.conversation_id as string);

  /* ② その会話のメッセージだけ。⚠️ `.in()` の絞り込みが唯一の防波堤（admin なので） */
  const { data: msgs, error: msgErr } = await admin
    .from("ow_conversation_messages")
    .select("conversation_id, sender_participant_id, sent_at")
    .in("conversation_id", convIds)
    .is("deleted_at", null);
  if (msgErr) {
    console.error("[unread] メッセージの取得に失敗:", msgErr.message);
    return result;
  }

  for (const p of parts) {
    const hit = (msgs ?? []).some((m) =>
      isUnreadMessage(m as MessageLike, {
        participantId: p.id as string,
        conversationId: p.conversation_id as string,
        lastReadAt: (p.last_read_at as string | null) ?? null,
      }),
    );
    if (hit) result.add(p.conversation_id as string);
  }
  return result;
}

export type MessageLike = {
  conversation_id: string;
  sender_participant_id: string | null;
  sent_at: string;
};

export type ParticipantLike = {
  participantId: string;
  conversationId: string;
  lastReadAt: string | null;
};

/**
 * その1通が、その参加者にとって未読か。
 *
 * ⚠️★**自分が送ったものは未読にしない**（`sender_participant_id` で比べる）。
 *    ⚠️ 比べるのは**参加者行の id** であって `user_id` ではない。列がそうなっている。
 * ⚠️ `last_read_at` が null は「一度も開いていない」＝**すべて未読**。
 *    ⚠️★**「古い」に倒さないこと。** 実測（2026-09-20）で本番の参加者行3件は
 *       **全部 null**。null を既読扱いにすると、この機能は永久に0を返す。
 */
export function isUnreadMessage(m: MessageLike, p: ParticipantLike): boolean {
  if (m.conversation_id !== p.conversationId) return false;
  if (m.sender_participant_id === p.participantId) return false;
  if (!p.lastReadAt) return true;
  return new Date(m.sent_at).getTime() > new Date(p.lastReadAt).getTime();
}
