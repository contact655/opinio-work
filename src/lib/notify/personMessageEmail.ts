import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import { notify } from "@/lib/notify/email";
import { personMessageTemplate } from "@/lib/notify/templates";

/**
 * ★個人からメッセージが届いたことを、メールでも知らせる（2026-10-20 / 柴さんの判断）。
 *   ベルはサイトを開いた人にしか見えないので、戻ってこない人には届いていないのと同じだった。
 *
 * 呼ぶ場所。⚠️★**条件（設定・まとめ・検証用と実在）を呼び出し側に書き写さないこと。**
 *   request … 最初の1通（lib/conversations/messageRequest.ts の sendMessageRequest）
 *   message … やり取りの中のメッセージ。`notifyNewMessage`（lib/notify/messageNotification.ts）が
 *             個人どうしの会話（kind = direct_message・返信済み）のときにここを呼ぶ。
 *             ⚠️ 送信経路（返信・つながりへの1通目・/api/dm/message・/api/dm/bulk-message）は
 *                すべて notifyNewMessage を通るので、経路ごとに呼ばない
 *
 * ── 送らないとき ──────────────────────────────────────────────────────────────
 * ① 本人が「個人からのメッセージをメールで受け取る」をオフにしている（ow_profiles。行が無ければオン）
 * ② 同じ会話について、30分以内にもう送っている（まとめて1通にする）。
 *    記録は企業からのメッセージと同じ ow_company_message_email_sends（thread_key = 'conversation:<id>'）
 * ③ 送り主と受け手の片方だけが検証用（そもそも送れない組み合わせだが、念のため）
 *
 * ⚠️★本文はメールに入れない（誰から届いたかとリンクだけ）。ログにも本文を出さない。
 * ⚠️ best-effort。失敗してもメッセージ送信は止めない。ただし握り潰さずログに出す。
 * ⚠️ ローカル dev では lib/notify/email.ts が送らない（EMAIL_SEND_IN_DEV=true のときだけ送る）。
 */

/** 同じ会話について、この時間内に続いたぶんはまとめる（送らない）。企業からのメッセージと同じ値 */
export const PERSON_MESSAGE_EMAIL_WINDOW_MINUTES = 30;

const SITE = "https://opinio.jp";

export async function emailPersonMessage(params: {
  kind: "request" | "message";
  /** ★`ow_users.id` 空間 */
  recipientOwUserId: string;
  /** ★`ow_users.id` 空間 */
  senderOwUserId: string;
  conversationId: string;
  /** request のときだけ。「相談：〈テーマ〉」「メッセージ」 */
  headline?: string | null;
  /** ログ用 */
  source: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const tag = `[person-message-email:${params.source}]`;
  try {
    if (params.recipientOwUserId === params.senderOwUserId) return { sent: false, skipped: "self" };

    /* ⚠️★no-store のクライアントを使う（設定と送信時刻が Next の fetch キャッシュに残らないように） */
    const db = createNoStoreAdminClient();
    const { data: users, error: uErr } = await db.from("ow_users")
      .select("id, email, name, auth_id, is_test, is_system")
      .in("id", [params.recipientOwUserId, params.senderOwUserId]);
    if (uErr) { console.error(`${tag} ow_users:`, uErr.message); return { sent: false, skipped: "error" }; }
    const recipient = (users ?? []).find((u) => u.id === params.recipientOwUserId);
    const sender = (users ?? []).find((u) => u.id === params.senderOwUserId);
    if (!recipient?.email || !recipient.auth_id || recipient.is_system || !sender) return { sent: false, skipped: "no-recipient" };

    /* ③ 検証用と実在のあいだでは送らない */
    if ((recipient.is_test === true) !== (sender.is_test === true)) return { sent: false, skipped: "test-mismatch" };

    /* ① 本人の設定。⚠️ ow_profiles.user_id は auth 空間。行が無ければ既定（オン） */
    const { data: prof, error: pErr } = await db.from("ow_profiles")
      .select("email_person_message_enabled").eq("user_id", recipient.auth_id as string).maybeSingle();
    if (pErr) { console.error(`${tag} ow_profiles:`, pErr.message); return { sent: false, skipped: "error" }; }
    if (prof && prof.email_person_message_enabled === false) return { sent: false, skipped: "opted-out" };

    /* ② 30分以内に送っていれば送らない。⚠️ 送る前に時刻を取る（同時に2本来ても1通にする） */
    const threadKey = `conversation:${params.conversationId}`;
    const cutoff = new Date(Date.now() - PERSON_MESSAGE_EMAIL_WINDOW_MINUTES * 60_000).toISOString();
    const now = new Date().toISOString();
    const { data: upd, error: updErr } = await db.from("ow_company_message_email_sends")
      .update({ last_sent_at: now })
      .eq("recipient_user_id", recipient.id).eq("thread_key", threadKey).lt("last_sent_at", cutoff)
      .select("thread_key");
    if (updErr) { console.error(`${tag} sends update:`, updErr.message); return { sent: false, skipped: "error" }; }
    if (!upd || upd.length === 0) {
      const { error: insErr } = await db.from("ow_company_message_email_sends")
        .insert({ recipient_user_id: recipient.id, thread_key: threadKey, last_sent_at: now });
      if (insErr) {
        if (insErr.code === "23505") return { sent: false, skipped: "within-window" };
        console.error(`${tag} sends insert:`, insErr.message);
        return { sent: false, skipped: "error" };
      }
    }

    /* ⚠️ request は受け手がまだ会話を開けない（返信するまで参加者に入らない）ので、未返信の一覧へ */
    const url = params.kind === "request"
      ? `${SITE}/mypage/conversations?tab=unreplied`
      : `${SITE}/mypage/conversations?open=${encodeURIComponent(params.conversationId)}`;

    await notify(personMessageTemplate({
      to: recipient.email as string,
      userName: recipient.name as string | null,
      senderName: (sender.name as string | null) ?? "",
      kind: params.kind,
      headline: params.kind === "request" ? params.headline ?? null : null,
      url,
    }));
    console.log(`${tag} 送った user=${recipient.id} ${threadKey}`);
    return { sent: true };
  } catch (e) {
    console.error(`${tag}`, e instanceof Error ? e.message : e);
    return { sent: false, skipped: "error" };
  }
}
