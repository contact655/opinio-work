/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★個人どうしのメッセージを、この2人のあいだで送れるか（2026-10-09 から。2026-11-13 に大きく緩めた）。
 *
 * ★★2026-11-13 / 柴さんの指示: **全ての人に送れるようにする。個人のブロックは無し。**
 *   それまで止めていた次の2つを外した。
 *     ・個人どうしのブロック（ow_user_blocks。表と行は残してあるが読まない）
 *     ・送る人が企業の担当者なら、その企業から見せてはいけない相手（`can_send_scout()` が false。
 *       今は考えていない・在籍歴・企業のブロックなど）には送れない、という段階1の規則
 *       （Next Manager の採用中のマネージャーが返信できない形になっていた）
 *   ⚠️ 担当者の個人メッセージは「メッセージのリクエスト」なので、返信があるまで続けて送れない・
 *      1日10件・返事待ち20件の上限はそのまま（lib/conversations/messageRequest.ts）。
 *
 * いま止めるのは次の2つだけ:
 *   1. ★**検証用と実在のアカウントのあいだ**（検証用は検証用どうしでだけ届く）。柴さんの判断で残した
 *   2. 相手が本人の登録していない行（auth_id が無い）
 *
 * ⚠️ 止めた理由は返さない。呼び出し側は「現在メッセージを送れません」とだけ返すこと（`CONTACT_BLOCKED_MESSAGE`）。
 * ⚠️ 判定に失敗したら**止める側**に倒す（fail-closed）。黙らずログを出す。
 * ⚠️ 使うのは `/api/dm/*` と `lib/conversations/messageRequest.ts`。**条件を書き写さないこと。**
 */
export const CONTACT_BLOCKED_MESSAGE = "現在メッセージを送れません";

/** 送る人（ow_users.id）が、相手（ow_users.id）に送ってはいけないなら true。 */
export async function isMessagingBlocked(senderOwUserId: string, recipientOwUserId: string): Promise<boolean> {
  const db = createAdminClient();

  const { data: pair, error: pErr } = await db
    .from("ow_users").select("id, is_test, auth_id").in("id", [senderOwUserId, recipientOwUserId]);
  if (pErr) {
    console.error("[contactGate] ow_users:", pErr.message);
    return true;
  }
  const sender = (pair ?? []).find((u) => u.id === senderOwUserId);
  const recipient = (pair ?? []).find((u) => u.id === recipientOwUserId);
  if (!sender || !recipient) return true;
  /* ⚠️ is_test は NOT NULL。true / false を比べる（null を同じとみなさない） */
  if ((sender.is_test === true) !== (recipient.is_test === true)) return true;
  /* ⚠️ auth_id が無い人（本人が登録していない行）には送らない */
  if (!((recipient.auth_id as string | null) ?? null)) return true;
  return false;
}
