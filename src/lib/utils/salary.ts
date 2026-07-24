/** 万円単位の数値をカンマ区切り文字列に変換（例: 1500 → "1,500"） */
export function fmtMan(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("ja-JP");
}

/** salary_min / salary_max から表示文字列を生成（例: "1,500〜2,500万円"） */
export function formatSalary(min: number | null | undefined, max: number | null | undefined): string {
  if (min && max) return `${fmtMan(min)}〜${fmtMan(max)}万円`;
  if (min) return `${fmtMan(min)}万円〜`;
  if (max) return `〜${fmtMan(max)}万円`;
  return "";
}
