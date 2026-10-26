/**
 * ★転機の3問から「あなたが合う職場の傾向」を本人にだけ出す（2026-10-27 / フェーズ1c）。
 *
 * ⚠️★材料は本人の回答だけ。他の利用者のデータも AI も使わない。決まった規則で文を組む。
 * ⚠️★回答が1つでもあれば、必ず1文は返す（柴さんの指示）。何も答えていなければ空配列。
 * ⚠️ 文は最大3つ。強い順に: 合っていた会社の決め手 → 合っていなかった会社の決め手 → 決め手の傾向 → いちばん求めていたこと。
 * ⚠️★このファイルは何も import しない（node のテストから直接読むため）。表示名は呼び出し側から渡す。
 */

export type TendencyTurn = {
  companyName: string;
  /** この転機が最初の会社か（Q2 の言い方を変える） */
  isFirst: boolean;
  decisiveReasons: string[];
  nextPriority: string | null;
  fitAfterYear: number | null;
};

export type TendencyLabels = {
  reason: (key: string) => string;
  priority: (key: string) => string;
  /** 4以上を「合っていた」 */
  goodMin: number;
  /** 2以下を「合っていなかった」 */
  badMax: number;
};

const MAX_LINES = 3;

const quote = (xs: string[]) => xs.map((x) => `「${x}」`).join("");

export function buildCareerTurnTendency(turns: readonly TendencyTurn[], L: TendencyLabels): string[] {
  const answered = turns.filter((t) => t.decisiveReasons.length > 0 || t.nextPriority !== null || t.fitAfterYear !== null);
  if (answered.length === 0) return [];
  const lines: string[] = [];
  const push = (s: string) => { if (lines.length < MAX_LINES && !lines.includes(s)) lines.push(s); };

  const good = answered.filter((t) => t.fitAfterYear !== null && t.fitAfterYear >= L.goodMin);
  const bad = answered.filter((t) => t.fitAfterYear !== null && t.fitAfterYear <= L.badMax);

  /* ① 合っていた会社の決め手。2社以上で共通する決め手があれば、それを先に */
  const goodWithReasons = good.filter((t) => t.decisiveReasons.length > 0);
  if (goodWithReasons.length >= 2) {
    const counts = new Map<string, number>();
    for (const t of goodWithReasons) for (const r of t.decisiveReasons) counts.set(r, (counts.get(r) ?? 0) + 1);
    const shared = Array.from(counts.entries()).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
    if (shared.length > 0) {
      const [key, n] = shared[0];
      push(`決め手に${quote([L.reason(key)])}を選んだ会社では、${n}社とも「合っていた」と答えています。`);
    }
  }
  for (const t of goodWithReasons) {
    push(`決め手に${quote(t.decisiveReasons.map(L.reason))}を選んだ${t.companyName}で「合っていた」と答えています。`);
  }

  /* ② 合っていなかった会社の決め手 */
  for (const t of bad.filter((x) => x.decisiveReasons.length > 0)) {
    push(`決め手に${quote(t.decisiveReasons.map(L.reason))}を選んだ${t.companyName}では「合っていなかった」と答えています。`);
  }

  /* ③ 合っていたかだけ答えた会社（決め手なし） */
  for (const t of answered.filter((x) => x.fitAfterYear !== null && x.decisiveReasons.length === 0)) {
    if (t.fitAfterYear! >= L.goodMin) push(`${t.companyName}は、入って1年たったころ「合っていた」と答えています。`);
    else if (t.fitAfterYear! <= L.badMax) push(`${t.companyName}は、入って1年たったころ「合っていなかった」と答えています。`);
  }

  /* ④ 決め手の傾向（合っていたかを答えていなくても出せる） */
  const withReasons = answered.filter((t) => t.decisiveReasons.length > 0);
  if (withReasons.length >= 2) {
    const counts = new Map<string, number>();
    for (const t of withReasons) for (const r of t.decisiveReasons) counts.set(r, (counts.get(r) ?? 0) + 1);
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) push(`会社を選ぶとき、${quote([L.reason(top[0])])}を決め手にすることが多いようです（${withReasons.length}社中${top[1]}社）。`);
  } else if (withReasons.length === 1 && lines.length === 0) {
    const t = withReasons[0];
    push(`${t.companyName}を選んだ決め手は${quote(t.decisiveReasons.map(L.reason))}でした。`);
  }

  /* ⑤ いちばん求めていたこと */
  const withPriority = answered.filter((t) => t.nextPriority !== null);
  if (withPriority.length >= 2) {
    const counts = new Map<string, number>();
    for (const t of withPriority) counts.set(t.nextPriority!, (counts.get(t.nextPriority!) ?? 0) + 1);
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top[1] >= 2) push(`転機では${quote([L.priority(top[0])])}をいちばん求めることが多いようです（${withPriority.length}回中${top[1]}回）。`);
  }
  if (lines.length === 0 && withPriority.length > 0) {
    const t = withPriority[withPriority.length - 1];
    push(t.isFirst
      ? `社会に出るときは、${quote([L.priority(t.nextPriority!)])}をいちばん求めていました。`
      : `${t.companyName}に移るときは、${quote([L.priority(t.nextPriority!)])}をいちばん求めていました。`);
  }

  /* ⚠️ ここまでで0文なら、合っていたかが「3」だけの回答。それでも1文は出す */
  if (lines.length === 0) {
    const t = answered[0];
    push(`${t.companyName}は、入って1年たったころ「どちらともいえない」と答えています。`);
  }
  return lines;
}
