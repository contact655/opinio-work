/**
 * 住所文字列から都道府県を抽出する
 *
 * 対応フォーマット:
 * - "東京都渋谷区..." → "東京都"
 * - "大阪府大阪市..." → "大阪府"
 * - "北海道札幌市..." → "北海道"
 * - "京都府京都市..." → "京都府"
 * - "福岡県福岡市..." → "福岡県"
 * - "" / null / undefined → ""
 *
 * 特殊ケース:
 * - 北海道: 「県」が付かない
 * - 東京都・大阪府・京都府: 「県」ではなく「都」「府」
 * - その他 43 県: 「○○県」
 */
export function extractPrefecture(location: string | null | undefined): string {
  if (!location) return "";
  const m = location.match(/^(北海道|東京都|大阪府|京都府|.+?[県])/);
  return m?.[1] ?? "";
}

/**
 * 47 都道府県のマスタ (フィルタ <select> の options 用)
 * 北から南の順序で定義
 */
export const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

/**
 * よく選ばれる都道府県。`<select>` の先頭に `<optgroup>` で出すためのもの。
 *
 * ⚠️ **`PREFECTURES` 本体の並び（北から南）は変えないこと。**
 *    `careerReasons.ts` の値検証（`VALID_PREFECTURES`）と
 *    `JobsClient` の絞り込みリストが同じ配列を見ており、
 *    そちらは地理順で出るのが正しい。並べ替えは表示側（select）で行う。
 *
 * ⚠️ 出すときは `OTHER_PREFECTURES` と組で使う。`PREFECTURES` 全件と並べると
 *    東京都が2回出て、選んだつもりの位置と選択位置がずれる。
 */
export const COMMON_PREFECTURES = ["東京都", "大阪府", "愛知県", "福岡県"] as const;

/** `COMMON_PREFECTURES` を除いた残り43件（北から南の順のまま）。 */
export const OTHER_PREFECTURES = PREFECTURES.filter(
  (p) => !(COMMON_PREFECTURES as readonly string[]).includes(p),
);

