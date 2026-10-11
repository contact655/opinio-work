import { unreadConversationIds } from "@/lib/conversations/unread";
import { unseenProposalConversationIds } from "@/lib/evidence/companyProposals";
import { unseenRepliedConversationIds } from "@/lib/approaches/server";

/**
 * ★`/biz` サイドバーの未読バッジ（2026-09-21 / 柴さんの指示）。
 *
 * | 項目 | 数えるもの |
 * |---|---|
 * | メッセージ | 未読のある会話 ∪ 送ったメッセージに返信があってまだ開いていない会話 ∪ ★提案から始まってまだ開いていない会話（**会話の数で、通数ではない**） |
 * | 提案 | ★会うかどうかを決める提案（企業の設定が「確認してから」のときだけ。2026-10-11）。判定は `lib/evidence/companyProposals.ts` |
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
  const [unread, replied, fromProposals] = await Promise.all([
    unreadConversationIds(params.owUserId, { companyId: params.companyId }),
    unseenRepliedConversationIds(params.companyId),
    /* ★提案から始まった会話は、企業の担当者がまだ参加者になっていない（参加者の未読では数えられない）ので別に数える */
    unseenProposalConversationIds(params.companyId),
  ]);
  return {
    messages: new Set([...Array.from(unread), ...Array.from(replied), ...Array.from(fromProposals)]).size,
    /* ★2026-10-11 から企業が答える紹介は無い（届いた方はその場で会話になり、上の messages で数える）。常に 0 */
    proposals: 0,
  };
}

/* ⚠️ ダッシュボードの「やること」用の `getBizTodoCounts` は 2026-10-10（段3）に外した。
      ホームは `lib/business/todayTodo.ts`（今日やること）を使う。面談申込の未読もそちらで数えている。 */
