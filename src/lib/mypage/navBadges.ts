/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { countUnreadConversations } from "@/lib/conversations/unread";
import { countOpenProposals } from "@/lib/evidence/proposalEnded";
import { countIncomingRequests } from "@/lib/conversations/messageRequest";

export type MypageNavBadges = {
  /** 「メッセージ」の数字 = 未読のある会話 ＋ 届いているお願い */
  conversations: number;
  applications: number;
  /** 未回答の提案。取得に失敗したら null（0 にしない ——「未回答は無い」と嘘になる） */
  proposals: number | null;
  /** 内訳（「届いているもの」のカードで使う） */
  unreadConversations: number;
  messageRequests: number;
};

/**
 * ★/mypage のナビの数字（2026-10-09）。**数え方はここの1か所。**
 * `/mypage` のホームはサーバーでこれを呼び、他のマイページは `GET /api/jobseeker/mypage-badges`
 * 経由で同じ関数を呼ぶ。⚠️ ページごとに数え方を書かないこと（割れると画面で数字が変わる）。
 *
 * ⚠️★ベルの既読とは**別に数える**。お願いは承認・断るまで、提案は回答するまで数字が消えない。
 * ⚠️ 「メッセージ」は未読の会話とお願いの**合計**。お願いだけにすると、未読のメッセージが
 *    数字から消える（2026-09-20 からある未読の数字を残すため）。
 *
 * ── /mypage/page.tsx から移した経緯（消さないこと） ─────────────────────────
 * ⚠️ **存在しない列で数えない。** 2026-08-20 まで `ow_conversations` の
 *    `company_user_id` / `updated_at`（どちらも無い列）で引いており毎回 400、
 *    `?? 0` が受けてバッジは常に 0 だった。**error を捨てない。**
 * ⚠️ **バッジは必ず一覧の部分集合にする。** 一覧（/mypage/conversations）は
 *    「自分の参加者行があるか」で絞る。2026-08-25 まで `candidate_user_id` /
 *    `partner_user_id` で数えており、押すと「まだ対話がありません」に着く形があった。
 *    ⚠️ お願いは参加者行が無いが、一覧の「届いているお願い」に出るので部分集合を保つ。
 * ⚠️ `ow_proposals.candidate_user_id` は **ow_users 空間**。未回答の条件は
 *    `/mypage/proposals` と同じ（`lib/evidence/proposalEnded.ts`）。
 */
export async function getMypageNavBadges(owUserId: string): Promise<MypageNavBadges> {
  const db = createAdminClient();
  const [unread, apps, proposals, requests] = await Promise.all([
    countUnreadConversations(owUserId),
    db.from("ow_job_applications").select("id", { count: "exact", head: true })
      .eq("user_id", owUserId).neq("status", "pending"),
    countOpenProposals("candidate", { candidateUserId: owUserId }),
    countIncomingRequests(owUserId),
  ]);
  if (apps.error) console.error("[mypage/navBadges] 応募:", apps.error.message);
  return {
    conversations: unread + requests,
    applications: apps.count ?? 0,
    proposals,
    unreadConversations: unread,
    messageRequests: requests,
  };
}
