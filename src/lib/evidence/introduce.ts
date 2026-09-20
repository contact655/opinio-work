/**
 * ③ 双方合意の紹介 —— mutual になった瞬間に会話を1本作る。
 *
 * ⚠️★**呼び出し側に条件を書き写さないこと。** 入口は
 *    [`saveProposalResponse()`](./respond.ts) の1箇所だけで、
 *    ②の route と⑨の route はそれを呼ぶだけ。2本に書くと必ず片方だけ直る。
 *
 * ⚠️★**紹介の器を新設しない。** `create_conversation` RPC に寄せる。
 *    自前で `ow_conversations` に INSERT すると `stage` を間違えて
 *    `ow_conversations_stage_consistency` に必ず違反する
 *    （2026-08-25 まで scout の返答がそれで500だった）。
 *
 * ⚠️★**admin クライアント（service_role）で呼ぶ。**
 *    RPC は 2026-09-21 の migration で service_role だけ
 *    「候補者本人か」の確認を素通しするようにした。
 *    **それ以前は、最後に答えたのが企業だと 42501 で落ちていた**
 *    （mutual は「最後に答えたほう」で成立するので半分が失敗する）。
 *
 * ⚠️★**`notifyNewMessage` は使えない。** あれは送信者を要求するが、紹介の会話には
 *    メッセージが1件も無い。そこで専用の種別 `introduction` を足した（2026-09-21）。
 *    ⚠️ 種別を足したら `survives()`（`GET /api/jobseeker/notifications`）にも
 *       `case` を足すこと。忘れるとその種別が丸ごと静かに消える。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createConversation } from "@/lib/conversations/createConversation";
import { mutateOne } from "@/lib/supabase/mutate";
import { proposalStage } from "@/lib/constants/proposalResponses";
import { notifyIntroduction } from "@/lib/notify/proposalNotification";

export type IntroduceOutcome =
  | { introduced: false; reason: "not_mutual" | "already" | "failed" }
  | { introduced: true; conversationId: string };

/**
 * 提案が mutual なら会話を作り、`introduced_at` に記録する。**冪等。**
 *
 * ⚠️ **best-effort。** 失敗しても返答そのものは取り消さない
 *    （返答は本人の操作で、紹介の失敗で巻き戻すほうが害が大きい）。
 *    ただし**握りつぶさない** —— 失敗は必ず `console.error` に出す。
 *
 * @param db ★**admin クライアント**（service_role）。利用者クライアントを渡さないこと
 */
export async function introduceIfMutual(
  db: SupabaseClient,
  proposalId: string,
): Promise<IntroduceOutcome> {
  const { data: row, error } = await db
    .from("ow_proposals")
    .select("candidate_user_id, company_id, candidate_response, company_response, introduced_at")
    .eq("id", proposalId)
    .maybeSingle();

  if (error) {
    console.error("[evidence/introduce] ow_proposals:", error.message);
    return { introduced: false, reason: "failed" };
  }
  if (!row) {
    console.error("[evidence/introduce] 提案が見つからない:", proposalId);
    return { introduced: false, reason: "failed" };
  }

  /* ★段は2つの返答から導出する。列で持たない（食い違う余地を作らない） */
  const stage = proposalStage(
    row.candidate_response as string | null,
    row.company_response as string | null,
  );
  if (stage !== "mutual") return { introduced: false, reason: "not_mutual" };

  /* ⚠️ RPC 自体は冪等だが、**通知とメールは二重に出る**ので記録で止める。
        判定に使うのは `introduced_at`（`conversation_id` は ON DELETE SET NULL
        で消えうるので「紹介したか」の正にならない）。 */
  if (row.introduced_at) return { introduced: false, reason: "already" };

  let conversationId: string;
  try {
    const created = await createConversation(db, {
      kind: "company",
      candidateUserId: row.candidate_user_id as string,
      companyId: row.company_id as string,
    });
    conversationId = created.conversationId;
  } catch (e) {
    console.error("[evidence/introduce] createConversation failed:", e);
    return { introduced: false, reason: "failed" };
  }

  /* ⚠️ 0行更新を成功として扱わない（CLAUDE.md） */
  const saved = await mutateOne(
    db
      .from("ow_proposals")
      .update({ conversation_id: conversationId, introduced_at: new Date().toISOString() })
      .eq("id", proposalId)
      /* ★二重紹介の最後の歯止め。同時に2つの返答が入っても1回しか通らない */
      .is("introduced_at", null),
    "proposal introduce",
  );
  if (!saved.ok) {
    console.error("[evidence/introduce] 記録に失敗:", saved.error);
    return { introduced: false, reason: "failed" };
  }

  /* ★知らせる。⚠️ **記録（`introduced_at`）を書いたあとに呼ぶ。**
        先に呼ぶと、記録に失敗したときに通知だけが二重に出る。
     ⚠️ 候補者にしか出ない（`/biz` に通知の面が無い）。企業は「会いたい」を
        押した本人なので、次に何が起きるかは知っている。 */
  await notifyIntroduction({
    proposalId,
    candidateUserId: row.candidate_user_id as string,
    companyId: row.company_id as string,
    conversationId,
  });

  console.log(`[evidence/introduce] 紹介した proposal=${proposalId} conversation=${conversationId}`);
  return { introduced: true, conversationId };
}
