import { unreadConversationIds } from "@/lib/conversations/unread";
import { unseenProposalConversationIds } from "@/lib/evidence/companyProposals";
import { unseenRepliedConversationIds } from "@/lib/approaches/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCompanyJoinRequests } from "@/lib/business/joinRequests";
import { can, type CompanyRole } from "@/lib/auth/roles";

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
/* ★members … 参加の依頼（2026-10-18）。`members.manage` の人だけ数える（それ以外は 0）。数え方は `fetchCompanyJoinRequests` */
export type BizNavBadges = { messages: number; proposals: number; members: number };

/**
 * ★「対応が必要なメッセージ」の会話（2026-10-12 / 柴さんの指示で1つにまとめた）。
 *   サイドバーのバッジ・ホームの「対応が必要なもの」が**この関数**で数える（メッセージ画面の「未読」タブと同じ3つの集合）。
 *   unread … 参加者として未読がある会話 ／ replied … 送ったメッセージに返信があって誰もまだ開いていない会話 ／
 *   fromProposals … 提案から始まって誰もまだ開いていない会話
 * ⚠️ 条件を呼び出し側で書き足さない。数え方を変えるときはここを変える（バッジとホームが同時に変わる）。
 */
export async function companyMessageTodoIds(params: { owUserId: string; companyId: string }): Promise<{
  unread: Set<string>; replied: Set<string>; fromProposals: Set<string>; all: Set<string>;
}> {
  const [unread, replied, fromProposals] = await Promise.all([
    unreadConversationIds(params.owUserId, { companyId: params.companyId }),
    unseenRepliedConversationIds(params.companyId),
    /* ★提案から始まった会話は、企業の担当者がまだ参加者になっていない（参加者の未読では数えられない）ので別に数える */
    unseenProposalConversationIds(params.companyId),
  ]);
  const all = new Set([...Array.from(unread), ...Array.from(replied), ...Array.from(fromProposals)]);
  return { unread, replied, fromProposals, all };
}

export async function getBizNavBadges(params: {
  owUserId: string;
  companyId: string;
  permission: CompanyRole;
}): Promise<BizNavBadges> {
  const [{ all }, joinRequests] = await Promise.all([
    companyMessageTodoIds(params),
    can(params.permission, "members.manage")
      ? fetchCompanyJoinRequests(createAdminClient(), params.companyId)
      : Promise.resolve([]),
  ]);
  return {
    messages: all.size,
    /* ⚠️ 取れなければ 0（バッジのために落とさない。ログは fetchCompanyJoinRequests が出す） */
    members: joinRequests?.length ?? 0,
    /* ★2026-10-11 から企業が答える紹介は無い（届いた方はその場で会話になり、上の messages で数える）。常に 0 */
    proposals: 0,
  };
}

/* ⚠️ ホームの「対応が必要なもの」は `lib/business/actionItems.ts`（2026-10-12）。メッセージは上の
      `companyMessageTodoIds` をそのまま使う。面談申込・応募の新規もそちらで数えている。 */
