import type { PublishRequirement } from "./publishRequirements";
import type { WordingHit } from "./wordingCheck";

/**
 * ★求人を「公開する」を押したときの判定（2026-10-12 / 柴さんの指示。運営の事前審査をやめ、即時公開にした）。
 *   **判定はここの1か所。** 作成・編集画面（ボタンの出し分け）・公開の API・運営画面が同じ関数を呼ぶ。
 *
 *   ① 公開に必要な17項目（publishRequirements.ts）が欠けている → 公開できない（下書きのまま）
 *   ② 企業ページが公開中（listed）でない                         → 公開できない（企業ページの公開後に公開できる）
 *      ⚠️ 企業ページの初回公開は運営が行う。ここが実在の確認になっている
 *   ③ 運営が停止した求人（stopped_at）                          → 運営確認中（運営が戻す）
 *   ④ 禁止表現（wordingCheck.ts）に当たる                       → 運営確認中（どの表現かを企業に出す）
 *   ⑤ それ以外                                                → すぐ公開
 * ⚠️ 純粋関数。DB を読まない（読んだ値を渡す）。ブラウザからも読む。
 */
export type PublishDecision =
  | { kind: "publish" }
  | { kind: "review"; reason: "wording"; hits: WordingHit[] }
  | { kind: "review"; reason: "stopped"; hits: WordingHit[] }
  | { kind: "blocked"; reason: "missing"; missing: PublishRequirement[] }
  | { kind: "blocked"; reason: "company_not_listed" };

export function decidePublish(input: {
  missing: PublishRequirement[];
  hits: WordingHit[];
  companyListed: boolean;
  stopped: boolean;
}): PublishDecision {
  if (input.missing.length > 0) return { kind: "blocked", reason: "missing", missing: input.missing };
  if (!input.companyListed) return { kind: "blocked", reason: "company_not_listed" };
  if (input.stopped) return { kind: "review", reason: "stopped", hits: input.hits };
  if (input.hits.length > 0) return { kind: "review", reason: "wording", hits: input.hits };
  return { kind: "publish" };
}

/** 企業ページが「公開中」か（企業ページが見えて、ディレクトリにも載っている） */
export function isCompanyListedForJobs(co: { is_published?: boolean | null; listing_status?: string | null } | null | undefined): boolean {
  return !!co && co.is_published === true && co.listing_status === "listed";
}

export const COMPANY_NOT_LISTED_MESSAGE = "企業ページの公開後に、求人を公開できます。企業ページの公開は OPINIO 運営が行います。";
export const POST_PUBLISH_NOTE = "公開後も運営が内容を確認し、問題がある場合は停止することがあります。";
