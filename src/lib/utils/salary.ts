/** 万円単位の数値をカンマ区切り文字列に変換（例: 1500 → "1,500"） */
export function fmtMan(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("ja-JP");
}

/**
 * ★報酬・給与の見出しの語（2026-10-10 / 柴さんの指示）。雇用形態が業務委託なら「報酬」、それ以外は「年収」。
 * ⚠️ 画面ごとに判定を書かないこと。ここ1か所。
 */
export function payLabel(employmentType: string | null | undefined): "報酬" | "年収" {
  return employmentType === "業務委託" ? "報酬" : "年収";
}

/**
 * ★報酬・給与の状態（2026-10-10）。
 *   amount     … 金額がある
 *   negotiable … 企業が「要相談」を選んだ（`ow_jobs.salary_negotiable`）
 *   hidden     … 金額が無く、要相談でもない（「給与非公開」）
 * ⚠️ negotiable と hidden を混ぜないこと（柴さんの指示で区別した）。
 */
export function payState(p: { min: number | null | undefined; max: number | null | undefined; negotiable?: boolean | null }): "amount" | "negotiable" | "hidden" {
  if ((p.min ?? 0) > 0 || (p.max ?? 0) > 0) return "amount";
  return p.negotiable === true ? "negotiable" : "hidden";
}

/** 「要相談」の1文（例: 報酬：要相談）。⚠️ 文言はここ1か所 */
export function payNegotiableText(employmentType: string | null | undefined): string {
  return `${payLabel(employmentType)}：要相談`;
}

/** salary_min / salary_max から表示文字列を生成（例: "1,500〜2,500万円"） */
export function formatSalary(min: number | null | undefined, max: number | null | undefined): string {
  if (min && max) return `${fmtMan(min)}〜${fmtMan(max)}万円`;
  if (min) return `${fmtMan(min)}万円〜`;
  if (max) return `〜${fmtMan(max)}万円`;
  return "";
}
