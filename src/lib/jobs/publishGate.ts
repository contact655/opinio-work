import type { PublishRequirement } from "./publishRequirements";
import { WORDING_FIELD_TARGETS, wordingMessage, type WordingHit } from "./wordingCheck";

/**
 * ★求人を「公開する」（停止中なら「再開する」）を押したときの判定（2026-10-12 / 柴さんの指示。即時公開）。
 *   **判定はここの1か所。** 作成・編集画面（ボタンの出し分け）・公開の API・運営画面が同じ関数を呼ぶ。
 *
 *   ① 公開に必要な17項目（publishRequirements.ts）が欠けている → 公開できない
 *   ② 禁止表現（wordingCheck.ts）に当たる                       → 公開できない（★2026-10-12 から。それまでは運営確認中）
 *   ③ 企業ページが公開中（listed）でない                         → 公開できない（企業ページの公開後に公開できる）
 *      ⚠️ 企業ページの初回公開は運営が行う。ここが実在の確認になっている
 *   ④ 運営が停止した求人（stopped_at）                          → 再開の依頼（pending_review。運営が戻す）
 *   ⑤ それ以外（自社で停止した求人の再開を含む）                → すぐ公開
 * ⚠️ 企業側から pending_review になるのは④だけ。
 * ⚠️ 純粋関数。DB を読まない（読んだ値を渡す）。ブラウザからも読む。
 */
export type PublishDecision =
  | { kind: "publish" }
  | { kind: "review"; reason: "stopped" }
  | { kind: "blocked"; reason: "missing"; missing: PublishRequirement[]; hits: WordingHit[] }
  | { kind: "blocked"; reason: "wording"; missing: PublishRequirement[]; hits: WordingHit[] }
  | { kind: "blocked"; reason: "company_not_listed" };

export function decidePublish(input: {
  missing: PublishRequirement[];
  hits: WordingHit[];
  companyListed: boolean;
  stopped: boolean;
}): PublishDecision {
  if (input.missing.length > 0) return { kind: "blocked", reason: "missing", missing: input.missing, hits: input.hits };
  if (input.hits.length > 0) return { kind: "blocked", reason: "wording", missing: input.missing, hits: input.hits };
  if (!input.companyListed) return { kind: "blocked", reason: "company_not_listed" };
  if (input.stopped) return { kind: "review", reason: "stopped" };
  return { kind: "publish" };
}

/**
 * ★禁止表現を「公開まであと〇項目」の1項目にする（2026-10-12）。押すとその表現がある入力欄へ移る。
 * ⚠️ 移動先は WORDING_FIELD_TARGETS（wordingCheck.ts）。知らない欄なら最初のステップの先頭
 */
export function wordingRequirements(hits: WordingHit[]): (PublishRequirement & { message: string })[] {
  return hits.map((h) => {
    const t = WORDING_FIELD_TARGETS[h.field] ?? { step: "job" as const, fieldId: "jef-title" };
    return { key: `wording:${h.field}:${h.match}`, label: `「${h.match}」（${h.field}）`, step: t.step, fieldId: t.fieldId, message: wordingMessage(h) };
  });
}

/** API が断るときの1行の文 */
export function blockedMessage(d: Extract<PublishDecision, { kind: "blocked" }>): string {
  if (d.reason === "company_not_listed") return COMPANY_NOT_LISTED_MESSAGE;
  const parts: string[] = [];
  if (d.missing.length > 0) parts.push(`公開の前に入力してください：${d.missing.map((m) => m.label).join("・")}`);
  for (const h of d.hits) parts.push(wordingMessage(h));
  return parts.join(" ");
}

/** 企業ページが「公開中」か（企業ページが見えて、ディレクトリにも載っている） */
export function isCompanyListedForJobs(co: { is_published?: boolean | null; listing_status?: string | null } | null | undefined): boolean {
  return !!co && co.is_published === true && co.listing_status === "listed";
}

export const COMPANY_NOT_LISTED_MESSAGE = "企業ページの公開後に、求人を公開できます。企業ページの公開は OPINIO 運営が行います。";
export const POST_PUBLISH_NOTE = "公開後も運営が内容を確認し、問題がある場合は停止することがあります。";
