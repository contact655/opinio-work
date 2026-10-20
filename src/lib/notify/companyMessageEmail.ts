import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import { notify } from "@/lib/notify/email";
import { companyMessageCandidateTemplate } from "@/lib/notify/templates";
import { companyDisplayName } from "@/lib/companies/displayName";
import { unsubscribeFor } from "@/lib/notify/unsubscribe";

/**
 * ★企業からメッセージが届いたことを、求職者にメールで知らせる（2026-10-11 / 柴さんの指示）。
 *
 * 呼ぶ場所は3つ。⚠️★**条件（設定・まとめ・実在の利用者への開始）を呼び出し側に書き写さないこと。**
 *   approach     … 企業からの1通目（lib/approaches/server.ts の sendApproach）
 *   （introduction … 紹介で企業が「会う」と答えたとき。2026-10-11 に企業が答える流れをなくしたので外した）
 *   reply        … 会話で企業から返信があった。★送信経路は4本（api/biz/conversations/[id]/messages ／
 *                  api/dm/message ／ api/dm/bulk-message ／ lib/meetings/server.ts の候補日・日程調整リンク）。
 *                  ⚠️ 4本とも `emailCandidateIfCompanySent` を呼ぶ（「企業との会話で、求職者本人でない人が送った」の判定を1か所に）
 *
 * ── 送らないとき ──────────────────────────────────────────────────────────────
 * ① 本人が「企業からのメッセージをメールで受け取る」をオフにしている（ow_profiles。行が無ければオン）
 * ② 同じ会話（または同じ声かけ）について、30分以内にもう送っている（まとめて1通にする）
 *    ⚠️ 最初の1通をすぐ送り、続く30分のぶんは送らない形。メールには「続けて届いたものは
 *       まとめてお知らせします」と書き、OPINIO を開けば全部読める
 * ③ ★実在の利用者で、`SEND_TO_REAL_USERS` が false（2026-10-11 から true）
 *    ⚠️★「全員が最初から受け取る」形の DB の変更（supabase/pending/20261011110000）を当てるまで、
 *       実在の利用者には送らない（柴さんの指示）。**当てる commit で true にすること。**
 *       検証用アカウント（is_test）には今から送る。
 *
 * ⚠️ best-effort。失敗してもメッセージ送信は止めない。ただし握り潰さずログに出す。
 * ⚠️★ログに本文・理由を出さない（ユーザーIDと会話IDまで）。
 * ⚠️ ローカル dev では lib/notify/email.ts が送らない（EMAIL_SEND_IN_DEV=true のときだけ送る）。
 */

/** ★2026-10-11 に DB の変更（20261011110000）を当てたので true にした。⚠️ false に戻すと実在の利用者に届かなくなる */
export const SEND_TO_REAL_USERS = true;

/** 同じ会話について、この時間内に続いたぶんはまとめる（送らない） */
export const COMPANY_MESSAGE_EMAIL_WINDOW_MINUTES = 30;

const SITE = "https://opinio.jp";

export async function emailCandidateCompanyMessage(params: {
  kind: "approach" | "reply";
  /** ★`ow_users.id` 空間 */
  candidateOwUserId: string;
  companyId: string;
  /** reply で必須 */
  conversationId?: string | null;
  /** approach で必須 */
  approachId?: string | null;
  /** approach のときだけ（冒頭だけがメールに入る） */
  reason?: string | null;
  /** ログ用。例: "approach" */
  source: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const tag = `[company-message-email:${params.source}]`;
  try {
    const threadKey = params.kind === "approach"
      ? (params.approachId ? `approach:${params.approachId}` : null)
      : (params.conversationId ? `conversation:${params.conversationId}` : null);
    if (!threadKey) {
      console.error(`${tag} 会話または声かけの id が無い`);
      return { sent: false, skipped: "no-thread" };
    }

    /* ⚠️★no-store のクライアントを使う。ふつうの admin クライアントだと Next の fetch キャッシュに
          設定と送信時刻が残り、オフにしたのに送る・30分たっても「まとめ中」のまま、になる（2026-10-11 に検証で踏んだ） */
    const db = createNoStoreAdminClient();
    const { data: user, error: uErr } = await db.from("ow_users")
      .select("id, email, name, auth_id, is_test, is_system").eq("id", params.candidateOwUserId).maybeSingle();
    if (uErr) { console.error(`${tag} ow_users:`, uErr.message); return { sent: false, skipped: "error" }; }
    if (!user?.email || !user.auth_id || user.is_system) return { sent: false, skipped: "no-recipient" };

    /* ③ 実在の利用者へはまだ送らない */
    if (!user.is_test && !SEND_TO_REAL_USERS) {
      console.info(`${tag} 実在の利用者には未開始のため送らない user=${user.id}`);
      return { sent: false, skipped: "real-user-not-started" };
    }

    /* ① 本人の設定。⚠️ ow_profiles.user_id は auth 空間。行が無ければ既定（オン） */
    const { data: prof, error: pErr } = await db.from("ow_profiles")
      .select("email_company_message_enabled").eq("user_id", user.auth_id as string).maybeSingle();
    if (pErr) { console.error(`${tag} ow_profiles:`, pErr.message); return { sent: false, skipped: "error" }; }
    if (prof && prof.email_company_message_enabled === false) return { sent: false, skipped: "opted-out" };

    /* ② 30分以内に送っていれば送らない。⚠️ 送る前に時刻を取る（同時に2本来ても1通にする） */
    const cutoff = new Date(Date.now() - COMPANY_MESSAGE_EMAIL_WINDOW_MINUTES * 60_000).toISOString();
    const now = new Date().toISOString();
    const { data: upd, error: updErr } = await db.from("ow_company_message_email_sends")
      .update({ last_sent_at: now })
      .eq("recipient_user_id", user.id).eq("thread_key", threadKey).lt("last_sent_at", cutoff)
      .select("thread_key");
    if (updErr) { console.error(`${tag} sends update:`, updErr.message); return { sent: false, skipped: "error" }; }
    if (!upd || upd.length === 0) {
      const { error: insErr } = await db.from("ow_company_message_email_sends")
        .insert({ recipient_user_id: user.id, thread_key: threadKey, last_sent_at: now });
      if (insErr) {
        if (insErr.code === "23505") return { sent: false, skipped: "within-window" };
        console.error(`${tag} sends insert:`, insErr.message);
        return { sent: false, skipped: "error" };
      }
    }

    const { data: co, error: cErr } = await db.from("ow_companies").select("name, name_en").eq("id", params.companyId).maybeSingle();
    if (cErr) console.error(`${tag} ow_companies:`, cErr.message);
    const companyName = co?.name ? companyDisplayName(co.name as string, co.name_en as string | null).displayName : "企業";

    const url = params.kind === "approach"
      ? `${SITE}/mypage/conversations?tab=unreplied`
      : `${SITE}/mypage/conversations?open=${encodeURIComponent(params.conversationId as string)}`;

    /* ★ログインせずに止めるリンクと、メールソフトの「配信停止」（2026-10-20） */
    const stop = unsubscribeFor(user.auth_id as string, "email_company_message_enabled");
    await notify({
      ...companyMessageCandidateTemplate({
        to: user.email as string,
        userName: user.name as string | null,
        companyName,
        kind: params.kind,
        reason: params.kind === "approach" ? params.reason ?? null : null,
        url,
        stopUrl: stop?.url ?? null,
      }),
      ...(stop ? { headers: stop.headers } : {}),
    });
    console.log(`${tag} 送った user=${user.id} ${threadKey}`);
    return { sent: true };
  } catch (e) {
    console.error(`${tag}`, e instanceof Error ? e.message : e);
    return { sent: false, skipped: "error" };
  }
}

/**
 * ★会話にメッセージを入れたあとに呼ぶ。企業との会話（kind=company）で、送った人が求職者本人でなければ
 *   求職者にメールで知らせる。⚠️ 送信経路を足したら必ずこれを呼ぶこと（判定を書き写さない）。
 */
export async function emailCandidateIfCompanySent(params: {
  conversation: { id: string; kind: string | null; company_id: string | null; candidate_user_id: string | null };
  /** ★`ow_users.id` 空間 */
  senderOwUserId: string;
  source: string;
}): Promise<void> {
  const c = params.conversation;
  if (c.kind !== "company" || !c.company_id || !c.candidate_user_id) return;
  if (params.senderOwUserId === c.candidate_user_id) return;
  await emailCandidateCompanyMessage({
    kind: "reply", candidateOwUserId: c.candidate_user_id, companyId: c.company_id,
    conversationId: c.id, source: params.source,
  });
}
