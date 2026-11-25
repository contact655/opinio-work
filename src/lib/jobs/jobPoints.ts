/**
 * 求人の「この募集のポイント」（ow_jobs.catch_copy）を、1行に1つ・3行までの形にそろえる（2026-11-25 / 柴さんの指示）。
 *
 * 何も import しない純粋な関数（`npm test` が直接読む）。
 * ⚠️ 書くとき（API）と出すとき（求人ページ）が同じ関数を通る。片方に規則を書き写さないこと。
 * ⚠️ 以前の値は1段落の文。その場合は1行目にそのまま出る（推測で分けない）。
 */
export const JOB_POINTS_MAX = 3;
export const JOB_POINT_MAX_CHARS = 60;

export function jobPointLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s・\-*●■◆]+/, "").trim())
    .filter(Boolean)
    .slice(0, JOB_POINTS_MAX);
}

/** 保存する形（1行に1つ・3行まで・1行60字まで）。空なら null */
export function normalizeJobPoints(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const lines = jobPointLines(text).map((l) => l.slice(0, JOB_POINT_MAX_CHARS));
  return lines.length > 0 ? lines.join("\n") : null;
}
