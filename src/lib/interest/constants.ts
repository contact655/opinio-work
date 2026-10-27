/**
 * ★「話を聞いてみたい」の決めごと（2026-10-27 / 話を聞きたい人 フェーズ1a・柴さんの決定）。**純粋な関数と定数。何も import しない**（node のテストから読むため）。
 *
 * 押したら、その会社に名前とプロフィールが届く。企業ページ・合う会社（上段の提案・下段）のどこから押しても、
 * 同じ確認の文言・同じ記録（ow_for_you_reactions）・同じ届け方。
 *
 * ★★担当者がいない会社には、名前を届けない（2026-10-27 / 柴さんの決定）。「話を聞いてみたい」は出さず、**「保存」を出す**
 *   （既存の ow_bookmarks。企業には何も届かない）。担当者が登録したら、その会社を保存している人に知らせるだけ。
 *   届くのは本人が改めて「話を聞いてみたい」を押したときだけ。
 *   ⚠️★**その会社が OPINIO にいない（担当者がいない）ことが分かる文言を、画面・通知のどこにも出さない。**
 *      外のサイトで直接応募するきっかけになるため。「参加したら知らせる」（同日に一度入れた）は**やめた**。
 *   ⚠️「押しておけば後で届く」形（担当者の登録待ち・90日）も**やめた**。戻さないこと。
 * ⚠️ 「双方合意」は企業から声をかける側（企業からのメッセージ）で守る。こちらは本人が自分で届ける形（応募に近い）。
 */

/** ★確認の文言の版。**文言を変えたら上げること**（何に同意して押したかの記録。ow_for_you_reactions.consent_version） */
export const INTEREST_CONSENT_VERSION = "2026-10-27";

/** ひとことの上限（提案の PROPOSAL_NOTE_MAX・DB の CHECK と同じ） */
export const INTEREST_NOTE_MAX = 200;

/** 届いてから企業の返事を待つ日数。過ぎたら本人に知らせる */
export const INTEREST_NO_REPLY_DAYS = 14;

export const INTEREST_SOURCES = ["for_you", "company_page", "proposal"] as const;
export type InterestSource = (typeof INTEREST_SOURCES)[number];

/** ⚠️ 担当者の登録待ち（awaiting_contact）と期限切れ（expired）は 2026-10-27 にやめた */
export const INTEREST_STATUSES = ["delivered", "replied", "no_reply"] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

/** ★押す前の確認の文言（2026-10-27 に柴さんが確定）。⚠️ 変えたら INTEREST_CONSENT_VERSION を上げる
 *  ⚠️ 担当者がいない会社ではボタンごと出さない（代わりに「保存」） */
export function interestConfirmText(companyName: string): { title: string; body: string[] } {
  return {
    title: `${companyName}に届けます`,
    body: [
      `${companyName}に、あなたの名前とプロフィールが届きます。`,
      "企業からメッセージが届くことがあります。",
    ],
  };
}

/** 押したあとの表示（本人向け） */
export function interestStatusText(status: InterestStatus | null, companyName: string): string {
  switch (status) {
    case "no_reply": return `${companyName}からはまだ返事がありません。`;
    case "replied":
    case "delivered":
    default: return `${companyName}に届けました。`;
  }
}

/** ★本人への知らせの文言（ベル）。noReply は 2026-10-27 に確定・companyJoined は案 */
export const INTEREST_NOTICE_TEXT = {
  noReply: (companyName: string) => `${companyName}からはまだ返事がありません。ほかにも、あなたの経歴に合う会社があります。`,
  /** ★保存した会社に担当者が付いたとき（案）。⚠️ 「参加しました」「担当者が登録しました」と書かない（いなかったことが分かる） */
  savedReady: (companyName: string) => `保存した${companyName}に、「話を聞いてみたい」を送れるようになりました。`,
} as const;

/**
 * ★運営が企業に伝えてよい人数の幅（柴さんの決定）。⚠️ 実数は企業に伝えない
 * 1〜4人 ／ 5〜9人 ／ 10人以上。0人は null
 */
export function interestCountBand(n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null;
  if (n <= 4) return "1〜4人";
  if (n <= 9) return "5〜9人";
  return "10人以上";
}

/** ★運営が企業に伝えてよい傾向の下限（業界・職種の大分類。3人以上の項目だけ） */
export const INTEREST_TREND_MIN = 3;

/** 傾向の内訳から、下限に届いた項目だけを残す（多い順・同数は名前順） */
export function trendItems(counts: Record<string, number>, min = INTEREST_TREND_MIN): { label: string; count: number }[] {
  return Object.entries(counts)
    .filter(([label, n]) => label && n >= min)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"));
}

/** 届けてから返事なしと見なす時刻を過ぎたか */
export function isNoReplyDue(deliveredAtIso: string, nowMs: number, days = INTEREST_NO_REPLY_DAYS): boolean {
  const t = Date.parse(deliveredAtIso);
  if (!Number.isFinite(t)) return false;
  return nowMs - t >= days * 24 * 3600_000;
}
