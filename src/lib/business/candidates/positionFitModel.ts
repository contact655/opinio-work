/**
 * ★ポジションで見る（2026-10-18 / 柴さんの指示・段1）。型と並べ方だけ（クライアントからも読む）。
 *   中身を作るのはサーバーの `positionFit.ts` だけ。
 *
 * 人事が知りたいのは「この人は何をしてきたか」ではなく「自社のこのポジションに合うのは誰か」。
 * 一覧の上で自社のポジション（求人。下書きも含む）を1つ選ぶと、カードの理由の行が
 * 「そのポジションに対して何が合っているか」に変わり、合う順に並ぶ。
 *
 * ⚠️★点数・％は画面に出さない（Hisato 思想⑦「マッチ度%を出さない」）。出すのは事実の並びと、足りない点1つだけ。
 * ⚠️★年齢・性別・年収では突き合わせない（年齢と性別は法令、年収は本人だけの値）。
 */

/** 自社のポジション（＝自社の求人。下書き・審査中・非公開も含む） */
export type PositionOption = {
  id: string;
  title: string;
  /** 公開中でないときの印（「下書き」など）。公開中は null */
  statusLabel: string | null;
};

/** 1つの項目（合っている ✓／足りない） */
export type PositionFitItem = {
  /** 項目名（職種・経験年数・希望職種・レベル・勤務地） */
  item: string;
  /** 1行に出す文（候補者側の値には出どころを付ける） */
  text: string;
  ok: boolean;
};

export type PositionFit = {
  items: PositionFitItem[];
  /** 並べるためだけの値（画面に出さない） */
  rank: number;
};

/** ポジション id → 候補者 id → 合うところ */
export type PositionFits = Record<string, Record<string, PositionFit>>;

/** ★このポジションに合う順（同じなら元の並び）。⚠️ 安定ソート */
export function sortByPositionFit<T extends { id: string }>(list: T[], fits: Record<string, PositionFit> | undefined): T[] {
  if (!fits) return list;
  const r = (id: string) => fits[id]?.rank ?? -1;
  return list.map((c, i) => ({ c, i })).sort((a, b) => r(b.c.id) - r(a.c.id) || a.i - b.i).map((x) => x.c);
}
