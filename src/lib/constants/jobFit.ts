/**
 * ★求人の「この職種の経験年数」と「ポジションのレベル」（2026-10-12 / 柴さんの指示）。
 *   どちらも任意で、選ぶだけ（自由入力にしない）。公開に必要な17項目には入れない。
 *   候補者を探すの「合うところ」に使う（`lib/business/candidates/touchpoints.ts`）。
 *
 * ⚠️★許容値は3層で揃える: この定数（UI と API）／ DB の CHECK
 *    （`ow_jobs_required_experience_years_check` / `ow_jobs_position_level_check`）。
 * ⚠️ レベルの語彙は職歴の役職（`RANKS`）と同じ。別の語彙を作らない（突き合わせられなくなる）。
 */
import { RANKS, isRankValue } from "@/lib/constants/careerOptions";

/** 0 = 不問。それ以外は「N年以上」 */
export const JOB_EXPERIENCE_YEARS = [
  { value: 0, label: "不問" },
  { value: 1, label: "1年以上" },
  { value: 3, label: "3年以上" },
  { value: 5, label: "5年以上" },
  { value: 10, label: "10年以上" },
] as const;

export function isJobExperienceYears(v: unknown): v is number {
  return typeof v === "number" && JOB_EXPERIENCE_YEARS.some((o) => o.value === v);
}

export function jobExperienceYearsLabel(v: number | null | undefined): string | null {
  return JOB_EXPERIENCE_YEARS.find((o) => o.value === v)?.label ?? null;
}

/** ポジションのレベル。職歴の役職と同じ選択肢 */
export const JOB_POSITION_LEVELS = RANKS;
export const isJobPositionLevel = isRankValue;

/**
 * 役職の段の高さ（`RANKS` の並び順）。知らない値は null。
 * ⚠️★`RANKS` の並びは「段の梯子」（careerOptions.ts）。並びを変えるとここの比較も変わる。
 */
export function rankOrder(value: string | null | undefined): number | null {
  if (!value) return null;
  const i = RANKS.findIndex((r) => r.value === value);
  return i < 0 ? null : i;
}

/**
 * API の body から読む。キーが無い＝触らない（undefined）／空＝null／不正＝"invalid"。
 * ⚠️ 空と不正を区別する（不正は 400。黙って null にしない）。
 */
export function parseJobExperienceYears(v: unknown): number | null | undefined | "invalid" {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return isJobExperienceYears(n) ? n : "invalid";
}
export function parseJobPositionLevel(v: unknown): string | null | undefined | "invalid" {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return isJobPositionLevel(v) ? v : "invalid";
}
