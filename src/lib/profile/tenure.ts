/**
 * 在籍期間・社会人経験年数の計算。
 *
 * ── なぜ切り出したか（2026-08-07）────────────────────────────────────────────
 * 元は MergedTimeline.tsx の中にあり、職歴カード1件ぶんの期間表示に使っていた。
 * 社会人経験年数（ow_profiles.experience_years）の入力欄を廃止し、
 * 職歴の最も古い started_at から自動計算することにしたため、
 * 同じ計算を /profile/edit からも呼ぶ。2つに書き写さない。
 *
 * ⚠️ 経験年数は「値が無ければ項目ごと出さない」。
 *    職歴が0件の人に「0年」と出さないこと（CLAUDE.md「データ表示の原則」）。
 *    そのために calcTotalExperience() は null を返す。
 */

/**
 * 期間文字列を作る（例: "2年3ヶ月"）。end が null なら現在まで。
 *
 * ⚠️ "YYYY-MM" 形式の終了日は月末まで在籍を意味するため +1ヶ月して数える。
 *    例: 2013-04 〜 2017-03 → 4年ちょうど（47ヶ月 + 1 = 48ヶ月）
 */
export function formatDuration(start: string, end: string | null): string {
  const months = countMonths(start, end);
  if (months === null || months <= 0) return "";
  return formatMonths(months);
}

/** 開始〜終了の月数。start が読めなければ null。 */
export function countMonths(start: string, end: string | null): number | null {
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;

  const endDate = end ? new Date(end) : new Date();
  if (Number.isNaN(endDate.getTime())) return null;
  const endAdjusted = end
    ? new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1)
    : endDate;

  return (
    (endAdjusted.getFullYear() - startDate.getFullYear()) * 12 +
    (endAdjusted.getMonth() - startDate.getMonth())
  );
}

/** "YYYY-MM" / "YYYY-MM-DD" → "YYYY年M月"。読めなければそのまま返す */
export function formatYmLabel(ym: string | null): string {
  if (!ym) return "";
  const parts = ym.split("-");
  if (parts.length < 2) return ym;
  const month = parseInt(parts[1], 10);
  if (Number.isNaN(month)) return ym;
  return `${parts[0]}年${month}月`;
}

/** 月数 → "N年Mヶ月" */
export function formatMonths(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months}ヶ月`;
  if (months === 0) return `${years}年`;
  return `${years}年${months}ヶ月`;
}

/**
 * 社会人経験年数。職歴のうち**最も古い開始日**から現在までを数える。
 *
 * ⚠️ 職歴が1件も無い（または開始日が読めない）なら **null を返す**。
 *    呼び出し側は項目ごと非表示にすること。「0年」と出さない。
 *
 * ⚠️ 空白期間は差し引かない。「社会人になってからの年数」であって
 *    「在籍月数の合計」ではない。転職の合間や休職を欠落として扱わないため。
 */
export function calcTotalExperience(
  startedAts: (string | null | undefined)[]
): { months: number; label: string } | null {
  const valid = startedAts.filter((s): s is string => typeof s === "string" && s.length > 0);
  if (valid.length === 0) return null;

  const oldest = valid.reduce((a, b) => (a < b ? a : b));
  const months = countMonths(oldest, null);
  if (months === null || months < 0) return null;

  return { months, label: formatMonths(months) };
}
