/**
 * キャリア関連ユーティリティ
 *
 * ow_experiences の DATE 型（YYYY-MM-DD）を扱う。
 * CareerTimeline（Commit F）および将来の表示コンポーネントで使用。
 */

// ─── calculateTenure ──────────────────────────────────────────────────────────

/**
 * 在籍年数を計算する。
 *
 * @param startDate - 開始日（"YYYY-MM-DD"）
 * @param endDate   - 終了日（"YYYY-MM-DD"）。null のとき現職 → 今日基準で計算
 * @returns { years, months, label }
 *   - years / months: 両端含む月数を 12 で割った整数値
 *   - label: "3年6ヶ月" | "3年" | "6ヶ月"（"現在" は呼び出し側が付与）
 *
 * @example
 *   calculateTenure("2017-04-01", "2023-08-31") → { years: 6, months: 5, label: "6年5ヶ月" }
 *   calculateTenure("2020-04-01", "2021-03-31") → { years: 1, months: 0, label: "1年" }
 *   calculateTenure("2024-01-01", "2024-01-31") → { years: 0, months: 1, label: "1ヶ月" }
 *   calculateTenure("2023-09-01", null)          → 今日基準で計算
 */
export function calculateTenure(
  startDate: string,
  endDate: string | null
): { years: number; months: number; label: string } {
  // YYYY-MM に正規化（DATE型 "YYYY-MM-DD" または "YYYY-MM" どちらでも対応）
  const startYM = startDate.slice(0, 7); // "YYYY-MM"
  const endYM   = endDate
    ? endDate.slice(0, 7)
    : new Date().toISOString().slice(0, 7); // 現職 → 今日の YYYY-MM

  const [startYear, startMonth] = startYM.split("-").map(Number);
  const [endYear,   endMonth  ] = endYM.split("-").map(Number);

  // 両端含む月数
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

  // 負値ガード（ended_at < started_at の不正データ対策）
  const safeMonths = Math.max(totalMonths, 1);

  const years  = Math.floor(safeMonths / 12);
  const months = safeMonths % 12;

  let label: string;
  if (years > 0 && months > 0) {
    label = `${years}年${months}ヶ月`;
  } else if (years > 0) {
    label = `${years}年`;
  } else {
    label = `${months}ヶ月`;
  }

  return { years, months, label };
}
