/**
 * `/companies` の分割ビュー（2026-09-08）。
 *
 * ⚠️★**しきい値は3箇所にある。ここは2箇所ぶんの正。**
 *   ① この定数 …… クリックを振り替えるか（`CompanySplitLinks`）
 *   ② この定数 …… 計測の帯の切れ目（`sentry.client.config.ts`）
 *   ③ **CSS のメディアクエリ**（`companies/(list)/page.tsx` の `@media (min-width: 1280px)`）
 *      —— CSS からは定数を参照できないので**手で合わせるしかない。**
 *      ⚠️ 変えるときは3箇所とも変えること。①だけ変えると「クリックは振り替わるのに
 *         ペインが出ない（＝押しても何も起きない）」という一番分かりにくい壊れ方になる。
 */
export const SPLIT_MIN_WIDTH = 1280;

/**
 * ★候補者検索（/biz/candidates）の分割ビュー。
 *
 * ⚠️★2026-10-11 に 1024px から **1280px**（/companies・/jobs と同じ）に揃えた（柴さんの指示）。
 *    1024〜1279px は一覧が4割しか無く、名前が「…」で切れ、カードの2行目以降を隠すしかなかったため。
 *    1279px 以下はカードを押すとプロフィール（/u/[id]）へ同じタブで移る。
 * ⚠️★しきい値は2箇所にある: ①この定数（クリックを振り替えるか。`CandidatesClient`）
 *    ②**CSS のメディアクエリ**（`CandidatesClient` の `@media (min-width: 1280px)`）。
 *    CSS からは定数を参照できないので手で合わせている。①だけ変えると「押してもプレビューが出ない」になる。
 * ⚠️ 定数は分けたまま `SPLIT_MIN_WIDTH` を指す（候補者だけ別の値に戻すときに、ここ1か所で済むように）。
 */
export const CANDIDATE_SPLIT_MIN_WIDTH = SPLIT_MIN_WIDTH;

/**
 * ビューポート幅の帯。**分割ビューが出る層がどれだけ居るか**を測るために使う。
 *
 * ⚠️★**生の数値をタグにしないこと。** Sentry のタグは高カーディナリティに弱く、
 *    幅をそのまま入れると値が数百種類に散って集計できない。
 * ⚠️ 切れ目のうち **1280 だけが意味を持つ**（`SPLIT_MIN_WIDTH`）。
 *    他は「モバイル / タブレット / 小さいノート」を分けるための目安。
 * ⚠️ 帯を後から変えると、**変更前後のデータが混ざって比較できなくなる。**
 *    増やしたくなったら新しいタグ名にすること。
 */
export function viewportBand(width: number): string {
  if (width < 768) return "0-767";
  if (width < 1024) return "768-1023";
  if (width < SPLIT_MIN_WIDTH) return "1024-1279";
  if (width < 1440) return "1280-1439";
  if (width < 1920) return "1440-1919";
  return "1920+";
}
