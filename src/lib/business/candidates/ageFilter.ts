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
 * ⚠️ ここが止めるのは絞り込みと並び替えだけ。表示は下の `isCandidateAgeDisplayEnabled`（表示が無効なら、こちらも無効）。
 * ⚠️★2026-10-12 に規約を改定し、年齢の**表示**は本番で有効にできるようになった。**絞り込み・並び替えは弁護士の確認待ちのまま**
 *    （労働施策総合推進法9条。企業自身が年齢で絞る形になる）。確認が済むまで本番で "true" にしないこと。
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
 * ★2026-10-12 にプライバシーポリシー第5-1項（別表）と求職者向け利用規約第7条第6項を改定し、
 *   「生年月日から算出した年齢（生年月日そのものは表示しない）」を企業の管理画面に出すことを明記した。
 *   ⇒ **本番で有効にしてよい**。有効にするのは Vercel の環境変数 CANDIDATE_AGE_DISPLAY_ENABLED=true（柴さんが設定する）。
 * ⚠️ 既定（未設定）は本番で無効のまま。「設定漏れで本番に出ない」向きを変えないこと。
 */
export function isCandidateAgeDisplayEnabled(): boolean {
  const v = process.env.CANDIDATE_AGE_DISPLAY_ENABLED;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}
