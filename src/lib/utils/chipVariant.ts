/**
 * チップ／小カードの色は「役割」で決める（2026-08-23 確立）。
 *
 * ⚠️ **色分けに凡例が無いなら、色で分けない。**
 *    以前は福利厚生・ツール・製品・求人カードがそれぞれ独自に色を決めており、
 *    緑が4通りの意味（金銭条件 / カスタマーサポート製品 / Salesforce / ハイブリッド勤務）で
 *    使われていた。読み手にはどれが何を指すのか判断できない。
 *
 * | variant | 意味 | 例 |
 * |---|---|---|
 * | `neutral` | 既定。**色に意味を持たせない** | 職種・雇用形態・勤務形態・ツール・製品・大半の福利厚生 |
 * | `money`   | **金銭的にプラスの条件だけ** | 年収レンジ・確定拠出年金・退職金・ストックオプション/RSU |
 *
 * ⚠️ **オレンジはカジュアル面談専用**。チップに使わない。
 * ⚠️ **紫・黄色は使わない。**
 * ⚠️ variant を増やすときは「凡例なしで意味が伝わるか」を先に考えること。
 *    伝わらないなら neutral のままにして、文言側で説明する。
 */
export type ChipVariant = "neutral" | "money";

export type ChipStyle = { color: string; bg: string; border: string };

export const CHIP_STYLES: Record<ChipVariant, ChipStyle> = {
  neutral: { color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)" },
  money:   { color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
};

export function chipStyle(variant: ChipVariant = "neutral"): ChipStyle {
  return CHIP_STYLES[variant];
}
