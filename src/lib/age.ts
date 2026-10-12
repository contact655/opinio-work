/**
 * 生年月日から年齢を計算する。
 * NULL / undefined の場合は null（非公開扱い）。
 * タイムゾーンずれを防ぐため、サーバ側で UTC 基準で計算。
 */
export function getUserAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;

  const today = new Date();
  const birth = new Date(birthDate);

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age >= 0 ? age : null; // 未来の日付なら null
}

/* ★入れられる生年月日の範囲（2026-10-13 / 柴さんの指示）。15〜100歳。
      ⚠️ それまで年の選択肢は「今年から101年ぶん」で、2018年生まれ（＝8歳）を選べ、企業の候補者一覧に「8歳」と出た。
      ⚠️ 判定はこの1か所。入力欄（オンボーディング・/mypage の編集）と PUT /api/jobseeker/profile が同じ関数を通る。
      ⚠️ 下限 15 は労働基準法の最低年齢（中学卒業）に合わせた。 */
export const BIRTH_MIN_AGE = 15;
export const BIRTH_MAX_AGE = 100;

/**
 * 生年の選択肢（新しい順）。今年−15 〜 今年−100。
 * ⚠️★範囲外の値が既に保存されている人のために、その年を足し戻す（`keepYear`）。
 *    足し戻さないと選択欄が空に見え、別の項目を直して保存した瞬間に生年月日が消える。
 */
export function birthYearOptions(keepYear?: string | number | null): number[] {
  const now = new Date().getFullYear();
  const years = Array.from({ length: BIRTH_MAX_AGE - BIRTH_MIN_AGE + 1 }, (_, i) => now - BIRTH_MIN_AGE - i);
  const k = Number(keepYear);
  if (k && !years.includes(k)) years.push(k);
  return years.sort((a, b) => b - a);
}

/** 生年月日（YYYY-MM-DD）が範囲外なら、画面に出す文言を返す。範囲内なら null */
export function birthDateRangeError(birthDate: string): string | null {
  const age = getUserAge(birthDate);
  if (age === null || age < BIRTH_MIN_AGE || age > BIRTH_MAX_AGE) {
    return `生年月日は${BIRTH_MIN_AGE}〜${BIRTH_MAX_AGE}歳の範囲で入力してください。`;
  }
  return null;
}
