/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★企業の担当者が、見せてはいけない人にメッセージを送れないようにする（2026-10-09 / 段階1）。
 *
 * 送る人が **企業の有効な担当者**（`ow_company_admins` の `user_id` があり `is_active`）で、
 * 相手がその企業から見て `can_send_scout()` が false（今は考えていない・ブロック・在籍歴・
 * 転職勧奨禁止）なら、送らずに止める。**所属する企業のどれか1つでも false なら止める。**
 *
 * ⚠️★これがないと、廃止したスカウトと同じことが担当者の個人アカウントの DM でできた
 *    （2026-10-09 に検証用アカウントで実測。「今は考えていない」の人にも届き、ベルの通知も出た）。
 * ⚠️★**つなぎの対策。** 担当者が担当者でないアカウントを使えば抜けられる。
 *    根本は DM を「メッセージのお願い」にする段階3。
 * ⚠️★止めた理由は返さない。呼び出し側は「現在メッセージを送れません」とだけ返すこと
 *    （`CONTACT_BLOCKED_MESSAGE`）。理由を返すと、相手の転職意欲やブロックが分かってしまう。
 * ⚠️ 判定に失敗したら**止める側**に倒す（fail-closed）。黙らずログを出す。
 * ⚠️ 使うのは `/api/dm/start`・`/api/dm/message`・`/api/dm/bulk-message` の3か所。
 *    **条件を書き写さないこと。**
 */
export const CONTACT_BLOCKED_MESSAGE = "現在メッセージを送れません";

/** 送る人（ow_users.id）が、相手（ow_users.id）に送ってはいけないなら true */
export async function isMessagingBlocked(senderOwUserId: string, recipientOwUserId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: memberships, error: mErr } = await db
    .from("ow_company_admins")
    .select("company_id")
    .eq("user_id", senderOwUserId)
    .eq("is_active", true);
  if (mErr) {
    console.error("[contactGate] ow_company_admins:", mErr.message);
    return true;
  }
  const companyIds = Array.from(new Set((memberships ?? []).map((m) => m.company_id as string)));
  /* 担当者でなければ、この規則は掛からない */
  if (companyIds.length === 0) return false;

  const { data: recipient, error: uErr } = await db
    .from("ow_users").select("auth_id").eq("id", recipientOwUserId).maybeSingle();
  if (uErr) {
    console.error("[contactGate] ow_users:", uErr.message);
    return true;
  }
  /* ⚠️ auth_id が無い人（本人が登録していない行）には送らない */
  const authId = (recipient?.auth_id as string | null) ?? null;
  if (!authId) return true;

  const results = await Promise.all(
    companyIds.map(async (companyId) => {
      /* ⚠️ `p_candidate_id` は auth 空間 */
      const { data, error } = await db.rpc("can_send_scout", {
        p_company_id: companyId,
        p_candidate_id: authId,
      });
      if (error) {
        console.error("[contactGate] can_send_scout:", error.message);
        return false;
      }
      return data === true;
    }),
  );
  return results.some((ok) => !ok);
}
