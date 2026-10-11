/* ★サーバー専用（環境変数を読む）。画面には page.tsx から true/false を渡す */
import "server-only";

/**
 * ★候補者を探すの「年齢」の絞り込み・並び替えを効かせるか（2026-10-12 / 柴さんの判断）。
 *   本番は無効のまま（弁護士の確認待ち）。ローカル・検証環境で有効にして確認する。
 *
 *   CANDIDATE_AGE_FILTER_ENABLED = "true"  → 有効
 *                                 = "false" → 無効
 *   未設定 → NODE_ENV が production 以外（ローカルの dev）なら有効、production（本番・Vercel のプレビュー）なら無効
 *
 * ⚠️★「既定で本番は無効」の向きを守ること。設定漏れで本番に出ないようにする（社内メモの `isCandidateNotesEnabled` と同じ形）。
 * ⚠️ 年齢の**表示**はこのスイッチと関係なく出す（2026-10-12 の方針）。ここが止めるのは絞り込みと並び替えだけ。
 */
export function isCandidateAgeFilterEnabled(): boolean {
  /* ★表示が無効なら絞り込みも無効（年齢の数が無いので絞れない。2026-10-12） */
  if (!isCandidateAgeDisplayEnabled()) return false;
  const v = process.env.CANDIDATE_AGE_FILTER_ENABLED;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * ★年齢の**表示**（候補者カード・右欄・/mypage/settings の「企業に見える項目」）を出すか（2026-10-12 / 柴さんの指示）。
 *   CANDIDATE_AGE_DISPLAY_ENABLED = "true" / "false"。未設定ならローカルの dev は有効、本番・Vercel プレビューは無効。
 * ⚠️★無効のときは**年齢の数もページに渡さない**（load.ts で birth_date を読まず、age を null にする）。
 * ⚠️ 規約改定（docs/privacy-policy-revision-20261012.md）と弁護士の確認が済むまで、本番では無効のまま。
 */
export function isCandidateAgeDisplayEnabled(): boolean {
  const v = process.env.CANDIDATE_AGE_DISPLAY_ENABLED;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}
