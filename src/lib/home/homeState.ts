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
/** ★おすすめのユーザー（2026-11-04）。「あなたに合う会社」より後・行き先より前 */
export const HOME_MOBILE_SUGGEST_AFTER = 3; // 4件目のあと
/** ★相談できる人（2026-11-12）。「あなたに合う会社」とおすすめのユーザーの間 */
export const HOME_MOBILE_CONSULTANTS_AFTER = 2; // 3件目のあと

/** ★職歴が0件の人の案内（2026-11-04 に1行の帯から右の列の箱へ） */
export const CAREER_BOX_TITLE = "職歴を1件入れましょう";
export const CAREER_BOX_BODY = "入れると、あなたに合う会社と、同じ経歴の人の行き先が出ます";
/**
 * ★職歴はあるが「前の会社」か「学歴」が無い人の案内（2026-11-12 / 柴さんの指示）。
 *   2026-09-15 にオンボーディングから過去の職歴・学歴の画面を外したため、登録後に1社だけ・学歴なしの人が多い
 *   （2026-11-12 実測: 直近30日の11人のうち 2社以上 0人・学歴なし 9人）。
 *   pastJob: 会社が1社だけで「これ以上の経歴はない」と答えていない ／ education: 学歴が0件
 * ⚠️ 職歴が0件の人には出さない（上の CAREER_BOX が出る）。
 */
export type CareerNudge = { pastJob: boolean; education: boolean };
export const CAREER_NUDGE_PAST_BODY = "前の会社を足すと、同じ会社にいた人が見つかります";
export const CAREER_NUDGE_PAST_LABEL = "前の会社を追加";
export const CAREER_NUDGE_PAST_HREF = "/mypage?add=past";
export const CAREER_NUDGE_EDU_BODY = "学校を足すと、同じ学校の人が見つかります";
export const CAREER_NUDGE_EDU_LABEL = "学歴を追加";
export const CAREER_NUDGE_EDU_HREF = "/mypage?add=education";

/** 案内の見出し。どちらも無ければ null（出さない） */
export function careerNudgeTitle(n: CareerNudge | null | undefined): string | null {
  if (!n) return null;
  if (n.pastJob && n.education) return "前の会社と学校を足しませんか";
  if (n.pastJob) return "前の会社を足しませんか";
  if (n.education) return "学校を足しませんか";
  return null;
}

/** 職歴の会社を見分けるキー（会社マスタの id、無ければ社名）。1社だけかの判定に使う */
export function careerCompanyCount(rows: { company_id: string | null; company_text: string | null; company_anonymized?: string | null }[]): number {
  return new Set(rows.map((r) => r.company_id ?? (r.company_text ?? r.company_anonymized ?? "").trim()).filter(Boolean)).size;
}

/** ★「次の1件」の職歴の文言（lib/people/sidebarData.ts の pickNextStep。/people の左サイドバーに出る） */
export const CAREER_NEXT_STEP_LABEL = "職歴を追加する";
/** ★職歴を入れる画面（/mypage の職歴の欄）。ホームの左のカードの「職歴を入れる」と pickNextStep が同じ行き先 */
export const CAREER_NEXT_STEP_HREF = "/mypage";
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
