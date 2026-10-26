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

/** "YYYY-MM" / "YYYY-MM-DD" → 通し月番号（年×12＋月−1）。読めなければ null */
function monthIndex(ym: string | null | undefined): number | null {
  if (!ym) return null;
  const m = /^(\d{4})-(\d{1,2})/.exec(ym);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  return y * 12 + (mo - 1);
}

/**
 * ★在籍期間の月数（2026-10-26 / フェーズ1b・柴さんの決定＝案C）。**プロフィールと企業ページはこの1つを使う。**
 *
 *   - 期間を月単位で数え、**開始月と終了月の両方を含める**（2021-11〜2024-12 は 38ヶ月）
 *   - 終了が null（現職）なら**今月まで**を含める
 *   - 複数の期間は**重なりを除いて足す**（同じ月は1回だけ数える）。隣の月どうしは続けて数え、
 *     空白の月（一度辞めて戻るまでのあいだ）は数えない
 *   - 日は見ない。2024-12-31 → 2025-01-01 は「12月・1月」で、隣の月として続く
 *
 *   ⚠️ 開始が読めない期間・終了が開始より前の期間は数えない。数えられる期間が1つも無ければ null
 *      （呼び出し側は項目ごと出さない。「0ヶ月」で埋めない）。
 *   ⚠️ 社会人経験年数（`calcTotalExperience`）は別の概念（最も古い開始から今日まで・空白も含む）。混ぜない。
 */
export function tenureMonths(
  ranges: readonly { startedAt: string | null | undefined; endedAt: string | null | undefined }[],
  now: Date = new Date(),
): number | null {
  const current = now.getFullYear() * 12 + now.getMonth();
  const spans: [number, number][] = [];
  for (const r of ranges) {
    const s = monthIndex(r.startedAt);
    if (s === null) continue;
    const e = r.endedAt ? monthIndex(r.endedAt) : current;
    if (e === null || e < s) continue;
    spans.push([s, e]);
  }
  if (spans.length === 0) return null;
  spans.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [cs, ce] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s <= ce + 1) { ce = Math.max(ce, e); continue; }
    total += ce - cs + 1;
    [cs, ce] = [s, e];
  }
  return total + (ce - cs + 1);
}

/** `tenureMonths` を「N年Mヶ月」にする。数えられなければ空文字（呼び出し側は出さない） */
export function formatTenure(
  ranges: readonly { startedAt: string | null | undefined; endedAt: string | null | undefined }[],
): string {
  const months = tenureMonths(ranges);
  return months && months > 0 ? formatMonths(months) : "";
}

/**
 * 期間文字列を作る（例: "2年3ヶ月"）。end が null なら今月まで。
 *
 * ★2026-10-26 から `tenureMonths` と同じ数え方（開始月と終了月を含める）。
 *    例: 2013-04 〜 2017-03 → 4年ちょうど（48ヶ月）。現職は**今月も含める**（以前は今月を含めていなかった）。
 */
export function formatDuration(start: string, end: string | null): string {
  return formatTenure([{ startedAt: start, endedAt: end }]);
}

/**
 * 開始〜終了の月数。start が読めなければ null。
 * ⚠️ いまは社会人経験年数（`calcTotalExperience`）だけが使う（今日までで、今月は含めない）。
 *    在籍期間には `tenureMonths` を使うこと。
 */
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
