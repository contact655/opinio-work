/**
 * ★会社規模の帯（2026-10-10 / 声かけまわり 段1）。**語彙と表示はここが唯一の定義。**
 *
 * 列: `ow_companies.employee_count_band`（8区分・CHECK）／ `employee_count_as_of`（date・任意）。
 * ⚠️★許容値は UI・API・DB の CHECK の3つを揃える（CLAUDE.md）。値を足すときは
 *    `ow_companies_employee_count_band_check` も同じ migration で広げること。
 * ⚠️ 自由記述の `employee_count` は原文として残っているが、**画面には出さない**。帯と時点だけを出す。
 * ⚠️ 変換の決めごと（約N名・N名以上・単体とグループ）は docs/company-size-band-20261010.md。
 */

export const EMPLOYEE_BANDS = [
  { value: "1-10",       label: "1〜10名" },
  { value: "11-50",      label: "11〜50名" },
  { value: "51-200",     label: "51〜200名" },
  { value: "201-500",    label: "201〜500名" },
  { value: "501-1000",   label: "501〜1,000名" },
  { value: "1001-5000",  label: "1,001〜5,000名" },
  { value: "5001-10000", label: "5,001〜10,000名" },
  { value: "10001+",     label: "10,001名以上" },
] as const;

export type EmployeeBand = (typeof EMPLOYEE_BANDS)[number]["value"];

const BAND_INDEX = new Map<string, number>(EMPLOYEE_BANDS.map((b, i) => [b.value, i]));

export function isEmployeeBand(v: unknown): v is EmployeeBand {
  return typeof v === "string" && BAND_INDEX.has(v);
}

/** 並び替え用の順位（小さい会社ほど小さい）。帯が無ければ -1（末尾に回すのは呼び出し側） */
export function employeeBandRank(v: string | null | undefined): number {
  return v ? BAND_INDEX.get(v) ?? -1 : -1;
}

/**
 * ★/companies の絞り込みと、声かけを受け取る範囲で使う4つのまとまり。
 * ⚠️ 8区分を細かく出すと選択肢が多すぎるので、絞り込みではこの4つにまとめる（柴さんの指示）。
 */
export const COMPANY_SIZE_GROUPS = [
  { value: "1-50",     label: "〜50名",        bands: ["1-10", "11-50"] },
  { value: "51-500",   label: "51〜500名",     bands: ["51-200", "201-500"] },
  { value: "501-5000", label: "501〜5,000名",  bands: ["501-1000", "1001-5000"] },
  /* ⚠️ value に「+」を使わない。URL の `?size=5001+` は「5001 」（空白）と読まれて絞り込みが効かない */
  { value: "5001-",    label: "5,001名〜",     bands: ["5001-10000", "10001+"] },
] as const;

export type CompanySizeGroup = (typeof COMPANY_SIZE_GROUPS)[number]["value"];

export function isCompanySizeGroup(v: unknown): v is CompanySizeGroup {
  return typeof v === "string" && COMPANY_SIZE_GROUPS.some((g) => g.value === v);
}

export function sizeGroupOfBand(v: string | null | undefined): CompanySizeGroup | null {
  if (!v) return null;
  return COMPANY_SIZE_GROUPS.find((g) => (g.bands as readonly string[]).includes(v))?.value ?? null;
}

/** 帯の下限・上限（JSON-LD の numberOfEmployees 用）。上限が無い帯は max = null */
export function employeeBandRange(v: string | null | undefined): { min: number; max: number | null } | null {
  if (!v) return null;
  const m = v.match(/^(\d+)(?:-(\d+)|\+)$/);
  return m ? { min: Number(m[1]), max: m[2] ? Number(m[2]) : null } : null;
}

/** "2026-04-01" → "2026年4月時点"。⚠️ 日まで分かっていても月までに揃える（柴さんの指示） */
export function formatAsOfMonth(asOf: string | null | undefined): string | null {
  const m = asOf ? asOf.match(/^(\d{4})-(\d{2})/) : null;
  return m ? `${m[1]}年${Number(m[2])}月時点` : null;
}

/**
 * ★表示: 「51〜200名（2026年4月時点）」。時点が無ければ帯だけ。帯が無ければ null（項目ごと出さない）。
 * ⚠️ `compact` は一覧カードなど狭い場所用（帯だけ）。時点は詳細で出す。
 */
export function formatEmployeeSize(
  band: string | null | undefined,
  asOf?: string | null,
  opts: { compact?: boolean } = {},
): string | null {
  const label = EMPLOYEE_BANDS.find((b) => b.value === band)?.label;
  if (!label) return null;
  const at = opts.compact ? null : formatAsOfMonth(asOf);
  return at ? `${label}（${at}）` : label;
}
