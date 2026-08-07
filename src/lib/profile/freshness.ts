/**
 * 「いつ更新されたか」の表示。
 *
 * ── なぜ要るか（2026-08-07）────────────────────────────────────────────────
 * 転職検討時期は「半年以内」と書いてあっても、**それがいつ時点の話か**が分からないと
 * 企業側は使えない。値と一緒に鮮度を出す。
 *
 * ⚠️ 更新日が無い（NULL）ときは **null を返す**。「不明」とも書かない。
 *    値が無いことをある値に置き換えない（CLAUDE.md「データ表示の原則」）。
 *    ow_profiles.transfer_timing_updated_at は 2026-08-07 に追加した列で、
 *    既存39件はすべて NULL。いつ入力されたか分からないので推測で埋めていない。
 */

/**
 * 「古い」と見なす月数。
 *
 * ⚠️ 3ヶ月にしているのは、転職検討時期の選択肢の**最短単位（1〜3ヶ月以内）と揃える**ため。
 *    ここを長くすると「1〜3ヶ月以内（8ヶ月前に更新）」という自己矛盾した表示が出る。
 */
export const STALE_AFTER_MONTHS = 3;

export type Freshness = {
  /** 経過月数 */
  months: number;
  /** 「3ヶ月前に更新」「今月更新」 */
  label: string;
  /** STALE_AFTER_MONTHS を超えているか */
  isStale: boolean;
};

/**
 * 更新日時 → 鮮度。**NULL / 不正な値なら null**（呼び出し側は鮮度ごと出さない）。
 *
 * @param now テスト用。省略時は現在時刻
 */
export function describeFreshness(
  updatedAt: string | null | undefined,
  now: Date = new Date()
): Freshness | null {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return null;

  const months = Math.max(
    0,
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  );

  const label =
    months === 0 ? "今月更新" :
    months < 12 ? `${months}ヶ月前に更新` :
    `${Math.floor(months / 12)}年以上前に更新`;

  return { months, label, isStale: months > STALE_AFTER_MONTHS };
}
