/**
 * ★検索の「こんなことばで探せます」（2026-10-21）。ヘッダーの検索欄の候補と、検索結果が0件の画面の両方で使う。
 * ⚠️★**実際に結果が出ることばだけにする。** 押して0件になる例は出さない。
 *    2026-10-21 実測: 営業35・外資系31・Salesforce14・セキュリティ4・年収800万円以上2。
 *    エンジニア・プロダクトマネージャー・カスタマーサクセス・マーケティングは0件、フルリモートは条件として読めなかった。
 *    足すときは先に検索して件数を確かめること
 * ⚠️ 「よく検索される」とは書かない（検索の回数から選んだものではない）
 */
export const SEARCH_EXAMPLES = ["営業", "外資系", "セキュリティ", "Salesforce", "年収800万円以上"] as const;

/**
 * ★最近の検索（その人のブラウザにだけ残す。2026-10-21）。
 * ⚠️ 置き場は localStorage（本人の手元の便利さのため）。読み書きは必ず try/catch（使えない環境でも画面は動く）
 */
const RECENT_KEY = "opinio:recent-searches";
const RECENT_MAX = 5;

export function readRecentSearches(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(q: string): void {
  const t = q.trim().slice(0, 100);
  if (!t) return;
  try {
    const next = [t, ...readRecentSearches().filter((x) => x !== t)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* 使えない環境では残さない */
  }
}

export function clearRecentSearches(): void {
  try { window.localStorage.removeItem(RECENT_KEY); } catch { /* noop */ }
}
