/**
 * `ow_companies.capital_type` の表示ラベル。
 *
 * ⚠️★**語彙は DB の CHECK と揃える。** 値を足すときは3つとも直すこと
 *    （CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」）。
 *
 * ⚠️ 2026-08-30 に `companies/[id]/page.tsx` のローカル定義からここへ移した。
 *    「拠点・資本関係」セクションを求人詳細でも出すことになり、**同じ表が2箇所に
 *    できるところだった。** 表示名がページごとに割れると、同じ値が違う語で出る。
 */
export const CAPITAL_TYPE_LABELS: Record<string, string> = {
  foreign_subsidiary:   "外資系日本法人",
  japanese_independent: "日系独立",
  japanese_group:       "日系グループ会社",
  other:                "その他",
};
