/**
 * 集計した人数を画面に出してよい下限。
 *
 * ── なぜ `runSearch.ts` から出したか（2026-09-18）────────────────────────────
 * 元は [lib/search/runSearch.ts](../search/runSearch.ts) に置いてあったが、
 * あのファイルは `createAdminClient` を import している**取得層**なので、
 * **定数を1つ読むためだけに Supabase の一式を引き込むことになる。**
 * 根拠エンジン（`lib/evidence/`）は DB に触らない純粋関数として書いてあり、
 * `node --test` で素の Node から直接実行する。そこに admin クライアントが
 * 紛れ込むと**テストが起動しない。**
 *
 * ⚠️★**値も使い手も変えていない。** `runSearch.ts` は今もここを再エクスポート
 *    しているので、`import { MIN_AGGREGATE_COUNT } from "@/lib/search/runSearch"`
 *    は従来どおり動く（`/search` の5箇所がその形）。
 *
 * ⚠️★**2つ目の下限を作らないこと。** 「人数を出す」判断はこの1つに揃える。
 *    しきい値が2つに割れると、同じ画面で「3人います」と「2人います」が
 *    混在して、どちらが正しいのか誰にも分からなくなる。
 */

/**
 * ★集計を出してよい下限。**5人**（2026-10-26 に 3 → 5。フェーズ1a-3 / 柴さんの決定）。
 *
 * n が少ない「1人います」「2人います」は**本人の特定に繋がる**ため、件数すら出さない。
 *
 * ★★下限に届かないときは、その項目ごと出さない（2026-10-26）。
 *    「少ないので表示しません」のような断りも出さない（断り自体が「1〜4人いる」ことを伝えるため）。
 *    ⚠️ それまでは「件数を伏せて名前だけ並べる」「割合を伏せて『挙げた人がいます』と出す」経路があり、
 *       n=1 だとその1人の回答がそのまま読めた（engine.ts の shared_motive）。
 *
 * ★★人数は**集計の母数から外す人を除いた後**で数える（`lib/aggregate/population.ts` の
 *    `isAggregatableUser`）。外すのは 本人が登録していない・検証用・システム・非公開・
 *    **統計利用を停止した人**（規約 第13条の4 第5項）。除く前に数えて判定しないこと。
 *
 * 使っている場所:
 *   - `/search` の人検索（未ログイン時の件数と、スキル帯の件数）
 *   - `lib/evidence/`（根拠の「N人が移っています」）
 *
 * ⚠️ 遷移データの集計方針と同じしきい値。**片方だけ動かさないこと。**
 */
export const MIN_AGGREGATE_COUNT = 5;

/** ★下限に届いているか。⚠️ 渡す n は、外す人を除いた後の人数 */
export function meetsAggregateMin(n: number): boolean {
  return n >= MIN_AGGREGATE_COUNT;
}

/**
 * ★経歴から出す集計の下限（2026-10-27 / 企業ページ「人の流れ」・柴さんの決定）。
 *   前職・行き先・平均在籍・社内の職種の変化は、**この人数以上**のときだけ項目ごと出す（下限未満は文言も出さない）。
 *   経歴はすでにプロフィールに出ている事実なので、非公開の回答（MIN_AGGREGATE_COUNT = 5）より低くしている。
 * ⚠️ 回答から出す項目（決め手・1年後に合っていたか）は MIN_AGGREGATE_COUNT（5人）のまま。混ぜないこと。
 * ⚠️ 人数は isAggregatableUser で外したあと、かつ会社名を出してよい職歴（visibility_company = 'real'）だけで数える。
 */
export const MIN_CAREER_FACT_COUNT = 3;

export function meetsCareerFactMin(n: number): boolean {
  return n >= MIN_CAREER_FACT_COUNT;
}
