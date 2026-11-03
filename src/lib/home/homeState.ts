/**
 * ★ホームの定数と小さな判定（2026-10-27 / 柴さんの決定）。**純粋な値と関数。何も import しない**（node のテストから読むため）。
 * ⚠️ 2026-11-03 に状態 A〜D の出し分け（homeStateOf）と見出しの切り替え（homeHeadline）は外した。
 *    ホームの並びを固定にしたため（/home/page.tsx の冒頭）。
 */

/** ホームに出す「あなたに合う会社」の数（下に「すべて見る →」） */
export const HOME_FOR_YOU_LIMIT = 3;

/** ★スマホでタイムラインに挟む位置（2026-11-04）。添字は0始まり＝「何件目の投稿の後ろか」から1を引いた値 */
export const HOME_MOBILE_FOR_YOU_AFTER = 1; // 2件目と3件目の間
export const HOME_MOBILE_PATHS_AFTER = 4;   // 5件目のあと

/** ★職歴が0件の人の案内（2026-11-04 に1行の帯から右の列の箱へ） */
export const CAREER_BOX_TITLE = "職歴を1件入れましょう";
export const CAREER_BOX_BODY = "入れると、あなたに合う会社と、同じ経歴の人の行き先が出ます";
/** ★左の列の「次の1件」の職歴の文言（lib/people/sidebarData.ts の pickNextStep）。案内を出している間はこれを隠す */
export const CAREER_NEXT_STEP_LABEL = "職歴を追加する";
/** ×で閉じたら出さない日数 */
export const CAREER_BANNER_HIDE_DAYS = 7;

/** 閉じた時刻から、出さない期限（ミリ秒） */
export function careerBannerHiddenUntil(nowMs: number): number {
  return nowMs + CAREER_BANNER_HIDE_DAYS * 24 * 60 * 60 * 1000;
}

/** 覚えた期限（文字列）で、いま隠すか。⚠️ 読めない・壊れた値は「出す」に倒す */
export function isCareerBannerHidden(stored: string | null, nowMs: number): boolean {
  if (!stored) return false;
  const until = Number(stored);
  if (!Number.isFinite(until)) return false;
  return nowMs < until;
}

/** ★職歴の案内を出している間は、左の列の「次の1件」が職歴なら隠す（同じ案内が2つ並ぶため。2026-11-04） */
export function leftNextStepWhileCareerPrompt<T extends { label: string }>(nextStep: T | null, careerPromptVisible: boolean): T | null {
  if (!nextStep) return null;
  return careerPromptVisible && nextStep.label === CAREER_NEXT_STEP_LABEL ? null : nextStep;
}
