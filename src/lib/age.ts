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
