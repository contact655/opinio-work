/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversation } from "@/lib/conversations/createConversation";
import { MUTUAL_RESPONSES } from "@/lib/constants/proposalResponses";

/**
 * ★企業との会話を「開いてよいか」の判定（2026-10-09 / 段階2）。**ここが唯一の判定。**
 *
 * | 理由 | 誰が始めたか | 掛ける判定 |
 * |---|---|---|
 * | 応募 | 本人 | `can_contact_without_stance()`（転職意欲**以外**） |
 * | カジュアル面談の申込 | 本人 | 同上 |
 * | 提案の双方合意 | OPINIO の提案 | `can_send_scout()`（転職意欲を含む全部） |
 * | ★企業からの声かけを承認した | 企業（求職者が承認） | `can_send_scout()`（転職意欲を含む全部。2026-10-09） |
 *
 * ⚠️★応募・申込は**本人が自分から連絡した**ので転職意欲を見ない（柴さんの判断・2026-10-09）。
 *    見ると、実在の利用者39人中17人が応募・申込できても会話が開かず、企業が返信できない。
 *    それ以外（is_test の一致・管理者本人・グループを含む在籍歴・手動ブロック・転職勧奨禁止）は見る。
 * ⚠️★is_test の一致（検証用の求職者 × 実在の企業、またはその逆では開かない）は、
 *    `can_contact_without_stance()` の中で見ている。**ここに書き足さない**（二重に書くと割れる）。
 * ⚠️★条件を TS に書き写さない。判定の中身は DB の2関数で、ここは「どれを使うか」だけを決める。
 *
 * 使う場所: 会話を作る3経路（応募の API・面談申込の API・提案の双方合意）と、
 *           企業との会話に送る3経路（`/api/biz/conversations/[id]/messages`・`/api/dm/message`・
 *           `/api/dm/bulk-message`）。**送るたびに確かめる**（ブロックや在籍の判明の後は送れない）。
 * ⚠️ 判定に失敗したら「開けない」に倒す（fail-closed）。黙らずログを出す。
 */

export type OpenReason = "application" | "casual_meeting" | "proposal" | "approach";

export async function companyConversationAllowed(
  candidateOwUserId: string,
  companyId: string,
): Promise<boolean> {
  const db = createAdminClient();
  const { data: cand, error: cErr } = await db
    .from("ow_users").select("auth_id").eq("id", candidateOwUserId).maybeSingle();
  if (cErr) {
    console.error("[openReason] ow_users:", cErr.message);
    return false;
  }
  const authId = (cand?.auth_id as string | null) ?? null;
  if (!authId) return false;

  /* ── 理由があるか ── */
  const { data: jobs, error: jErr } = await db.from("ow_jobs").select("id").eq("company_id", companyId);
  if (jErr) console.error("[openReason] ow_jobs:", jErr.message);
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  const [app, meet, prop, appr] = await Promise.all([
    jobIds.length > 0
      ? db.from("ow_job_applications").select("id", { count: "exact", head: true })
          .eq("user_id", candidateOwUserId).in("job_id", jobIds)
      : Promise.resolve({ count: 0, error: null }),
    db.from("ow_casual_meetings").select("id", { count: "exact", head: true })
      .eq("user_id", candidateOwUserId).eq("company_id", companyId),
    db.from("ow_proposals").select("id", { count: "exact", head: true })
      .eq("candidate_user_id", candidateOwUserId).eq("company_id", companyId)
      .eq("candidate_response", MUTUAL_RESPONSES.candidate)
      .eq("company_response", MUTUAL_RESPONSES.company),
    /* ★企業からの声かけを求職者が承認した（2026-10-09）。⚠️ 見送った・未回答は理由にならない */
    db.from("ow_company_approaches").select("id", { count: "exact", head: true })
      .eq("candidate_user_id", candidateOwUserId).eq("company_id", companyId)
      .not("accepted_at", "is", null),
  ]);
  for (const [label, r] of [["applications", app], ["casual_meetings", meet], ["proposals", prop], ["company_approaches", appr]] as const) {
    if (r.error) console.error(`[openReason] ${label}:`, r.error.message);
  }
  const selfInitiated = (app.count ?? 0) > 0 || (meet.count ?? 0) > 0;
  /* ⚠️ 声かけは企業から始まったので、提案と同じく転職意欲まで見る（下の can_send_scout） */
  const mutualProposal = (prop.count ?? 0) > 0 || (appr.count ?? 0) > 0;
  if (!selfInitiated && !mutualProposal) return false;

  /* ── 見せてよいか（本人発は転職意欲を見ない）── */
  if (selfInitiated) {
    const { data, error } = await db.rpc("can_contact_without_stance", {
      p_company_id: companyId,
      p_candidate_id: authId,
    });
    if (error) console.error("[openReason] can_contact_without_stance:", error.message);
    if (data === true) return true;
  }
  if (mutualProposal) {
    const { data, error } = await db.rpc("can_send_scout", {
      p_company_id: companyId,
      p_candidate_id: authId,
    });
    if (error) console.error("[openReason] can_send_scout:", error.message);
    if (data === true) return true;
  }
  return false;
}

/**
 * ★企業との会話を作る（判定を通したときだけ）。**会話を作る経路はすべてここを通す。**
 * ⚠️ admin クライアントで `create_conversation` を呼ぶ（クライアントのロールからは呼べない）。
 * ⚠️ 開けないときは null を返す。呼び出し側は理由を利用者に出さない。
 */
export async function openCompanyConversation(params: {
  candidateOwUserId: string;
  companyId: string;
  source: OpenReason;
}): Promise<{ conversationId: string; created: boolean } | null> {
  if (!(await companyConversationAllowed(params.candidateOwUserId, params.companyId))) {
    console.warn(`[openReason] 会話を開かなかった source=${params.source}`);
    return null;
  }
  return createConversation(createAdminClient(), {
    kind: "company",
    candidateUserId: params.candidateOwUserId,
    companyId: params.companyId,
  });
}
