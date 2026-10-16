/**
 * ★職歴ごとの年収（万円）の決まり（2026-10-16 / フェーズ2）。
 *
 * ⚠️ 上限・下限は DB の CHECK（`ow_experience_salaries.amount_man > 0 and <= 100000`）と同じ値にする。
 *    **片方だけ変えないこと**（UI・API・DB の3つを揃える）。
 * ⚠️ 年収は**本人の編集画面にだけ**出す。他の利用者・企業・運営の一覧に出さない。
 */
export const EXPERIENCE_SALARY_MIN_MAN = 1;
export const EXPERIENCE_SALARY_MAX_MAN = 100000;

/** 画面に出す一文。⚠️ 文言を変えるときは、実際に誰にも見せていないことを確かめてから */
export const EXPERIENCE_SALARY_PRIVACY_NOTE = "この情報は公開されず、企業にも表示されません。";

/**
 * 入力を解釈する。空 → null（消す）／整数で範囲内 → その値／それ以外 → "invalid"。
 * ⚠️ 不正値を黙って null に倒さない（消えたように見える）。呼び出し側で 400 を返す。
 */
export function parseExperienceSalary(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "invalid";
  if (n < EXPERIENCE_SALARY_MIN_MAN || n > EXPERIENCE_SALARY_MAX_MAN) return "invalid";
  return n;
}
