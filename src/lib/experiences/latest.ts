/**
 * ★本人の「直近の職歴」を選ぶ（2026-11-04）。現職があれば現職、無ければいちばん新しく始まった職歴。開始日の無い職歴は使わない。
 *   /home（直近の会社）・lib/paths（/home の行き先・/people の「自分の直近の経歴」）が同じ関数を見る。書き写さないこと。
 * ⚠️ 何も import しない（純粋な関数）。
 */
export function pickLatestExperience<T extends { started_at: string | null; is_current: boolean | null }>(rows: readonly T[]): T | null {
  return [...rows]
    .filter((e) => e.started_at)
    .sort((a, b) => Number(b.is_current === true) - Number(a.is_current === true) || (b.started_at as string).localeCompare(a.started_at as string))[0] ?? null;
}
