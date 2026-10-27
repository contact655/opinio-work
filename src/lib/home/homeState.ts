/**
 * ★ホームの状態と見出し（2026-10-27 / 柴さんの決定）。**純粋な関数。何も import しない**（node のテストから読むため）。
 */
export type HomeState = "A" | "B" | "C" | "D";

/** ホームに出す「あなたに合う会社」の数（下に「すべて見る →」） */
export const HOME_FOR_YOU_LIMIT = 3;

/**
 * A 職歴なし ／ B 職歴はあるが振り返り（転機の3問）に答えた会社が0 ／ C 答えているが似た経歴の集計が下限未満 ／ D 集計が出せる
 * ⚠️ 「答えた」は /mypage の帯と同じ（転機の3問に答えたか「答えない」を選んだ会社。旧形式を写しただけの回答は数えない）
 */
export function homeStateOf(i: { hasExperience: boolean; answeredTurns: number; hasSimilar: boolean }): HomeState {
  if (!i.hasExperience) return "A";
  if (i.answeredTurns === 0) return "B";
  return i.hasSimilar ? "D" : "C";
}

/** ★見出しは出せる中身に合わせる（1年後に合っていた割合が出せるときだけ「こう感じています」） */
export function homeHeadline(hasFit: boolean): string {
  return hasFit
    ? "あなたと似た経歴の人は、こう動いて、こう感じています。"
    : "あなたと似た経歴の人は、こう動いています。";
}
