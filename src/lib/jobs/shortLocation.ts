/**
 * ★求人の勤務地を「都道府県＋市区町村」までに縮める（2026-10-12 / 求人管理の一覧の2行目）。
 *   例: 「東京都港区虎ノ門1-2-3 ○○ビル5F」→「東京都港区」／「大阪府大阪市北区梅田…」→「大阪府大阪市北区」。
 * ⚠️ 一覧の表示だけに使う。求人の詳細・編集画面は元の値のまま。
 * ⚠️ 読めないもの（都道府県が無い・自由な書き方）は、数字の手前までを返す（番地を出さないため）。
 */
const PREF = "(北海道|東京都|京都府|大阪府|.{2,3}県)";
const CITY = "(.+?郡.+?[町村]|.+?市.+?区|.+?[市区町村])";
const RE = new RegExp(`^\\s*${PREF}\\s*${CITY}?`);

export function shortLocation(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = s.match(RE);
  if (m) return `${m[1]}${m[2] ?? ""}`;
  /* 都道府県が読めないとき: 最初の数字・空白の手前まで */
  const head = s.split(/[\s0-9０-９]/)[0];
  return head || null;
}
