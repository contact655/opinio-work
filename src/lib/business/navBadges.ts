import { unreadConversationIds } from "@/lib/conversations/unread";
import { countOpenProposals as countOpenProposalsShared } from "@/lib/evidence/proposalEnded";
import { countUnseenAcceptedApproaches } from "@/lib/approaches/server";

/**
 * ★`/biz` サイドバーの未読バッジ（2026-09-21 / 柴さんの指示）。
 *
 * | 項目 | 数えるもの |
 * |---|---|
 * | メッセージ | 未読のある会話の数（**通数ではない**）。一覧のドットと同じ `unreadConversationIds` |
 * | 声かけ | 承認されて、まだ企業が会話を開いていない声かけ（2026-10-10）。判定は `countUnseenAcceptedApproaches`。⚠️ 見送られたものは数えない |
 * | 提案 | 企業がまだ答えていない提案。⚠️ **終了したもの**（候補者が見送った／いまは見せてはいけない候補者）は数えない。判定は `lib/evidence/proposalEnded.ts` |
 *
 * ⚠️★**失敗したら 0 を返す（ログは出す）。** バッジのために `/biz` 全体を落とさない。
 *    その代わり「0 = 無い」とは限らない。**数字が出ないことを根拠に「未読なし」と判断しないこと。**
 * ⚠️ 呼ぶのは `GET /api/biz/nav-badges` の1箇所だけ。サイドバーがページを移るたびに取る。
 *    ⚠️★layout で数えないこと —— layout はページ移動で描き直されず、数字が古いまま残る。
 */
export type BizNavBadges = { messages: number; proposals: number; approaches: number };

export async function getBizNavBadges(params: {
  owUserId: string;
  companyId: string;
}): Promise<BizNavBadges> {
  const [unread, proposals, approaches] = await Promise.all([
    unreadConversationIds(params.owUserId, { companyId: params.companyId }),
    countOpenProposals(params.companyId),
    countUnseenAcceptedApproaches(params.companyId),
  ]);
  return { messages: unread.size, proposals, approaches };
}

/* ★画面（`/biz/proposals` の「未回答」）と同じ条件で数える（2026-10-09）。
      ⚠️ 条件をここに書き写さないこと。⚠️ 失敗したら 0（ログは共通関数が出す） */
async function countOpenProposals(companyId: string): Promise<number> {
  return (await countOpenProposalsShared("company", { companyId })) ?? 0;
}

/* ⚠️ ダッシュボードの「やること」用の `getBizTodoCounts` は 2026-10-10（段3）に外した。
      ホームは `lib/business/todayTodo.ts`（今日やること）を使う。面談申込の未読もそちらで数えている。 */
