import { createAdminClient } from "@/lib/supabase/admin";
import { unreadConversationIds } from "@/lib/conversations/unread";
import { countOpenProposals as countOpenProposalsShared } from "@/lib/evidence/proposalEnded";

/**
 * ★`/biz` サイドバーの未読バッジ（2026-09-21 / 柴さんの指示）。
 *
 * | 項目 | 数えるもの |
 * |---|---|
 * | メッセージ | 未読のある会話の数（**通数ではない**）。一覧のドットと同じ `unreadConversationIds` |
 * | 提案 | 企業がまだ答えていない提案。⚠️ **終了したもの**（候補者が見送った／いまは見せてはいけない候補者）は数えない。判定は `lib/evidence/proposalEnded.ts` |
 *
 * ⚠️★**失敗したら 0 を返す（ログは出す）。** バッジのために `/biz` 全体を落とさない。
 *    その代わり「0 = 無い」とは限らない。**数字が出ないことを根拠に「未読なし」と判断しないこと。**
 * ⚠️ 呼ぶのは `GET /api/biz/nav-badges` の1箇所だけ。サイドバーがページを移るたびに取る。
 *    ⚠️★layout で数えないこと —— layout はページ移動で描き直されず、数字が古いまま残る。
 */
export type BizNavBadges = { messages: number; proposals: number };

export async function getBizNavBadges(params: {
  owUserId: string;
  companyId: string;
}): Promise<BizNavBadges> {
  const [unread, proposals] = await Promise.all([
    unreadConversationIds(params.owUserId, { companyId: params.companyId }),
    countOpenProposals(params.companyId),
  ]);
  return { messages: unread.size, proposals };
}

/* ★画面（`/biz/proposals` の「未回答」）と同じ条件で数える（2026-10-09）。
      ⚠️ 条件をここに書き写さないこと。⚠️ 失敗したら 0（ログは共通関数が出す） */
async function countOpenProposals(companyId: string): Promise<number> {
  return (await countOpenProposalsShared("company", { companyId })) ?? 0;
}

/**
 * ★ダッシュボードの「やること」（2026-09-21）。
 * ⚠️★メッセージと提案は**サイドバーのバッジと同じ関数**で数える。数字が食い違わないように。
 * ⚠️ 差し戻された求人はページ側が既に持っている件数（`getJobStatusCounts`）を使う。ここでは数えない。
 */
export type BizTodoCounts = BizNavBadges & { meetings: number };

export async function getBizTodoCounts(params: { owUserId: string; companyId: string }): Promise<BizTodoCounts> {
  const [badges, meetings] = await Promise.all([getBizNavBadges(params), countUnreadMeetings(params.companyId)]);
  return { ...badges, meetings };
}

/**
 * 企業がまだ開いていない面談申込。`/biz/meetings` の未読（`company_read_at` が null）と同じ条件。
 * ⚠️ 失敗したら 0（ログは出す）。
 */
async function countUnreadMeetings(companyId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("ow_casual_meetings")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("company_read_at", null);
  if (error) {
    console.error("[navBadges] 面談申込の件数を取得できませんでした:", error.message);
    return 0;
  }
  return count ?? 0;
}
