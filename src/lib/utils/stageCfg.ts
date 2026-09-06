import { PHASE_OPTIONS } from "@/lib/constants/phase";

/**
 * 企業ページのフェーズバッジ。
 *
 * ⚠️★**語彙を持たない。** ラベルは [lib/constants/phase.ts](../constants/phase.ts) から引く。
 *    2026-09-06 まで、ここに**30キーの独自テーブル**があった。同じ意味の値が
 *    `phase.ts`（12個・日本語）／`mockCompany.ts`（8個・別の日本語）／ここ（30キー）／
 *    DB の CHECK（8個・英語）と**4か所に割れており**、どれも噛み合っていなかった。
 *    → 選択肢の唯一の出どころは `phase.ts`。ここに値を書き足さないこと。
 *
 * ⚠️ **資金調達フェーズを色で出し分けない（2026-08-23）。**
 *    以前はフェーズごとに虹色（シード＝黄 / シリーズA＝緑 / 上場＝緑 …）を当てていた。
 *    凡例が無いので色の意味が伝わらず、とくに緑が
 *    「金銭的にプラスの条件」（年収・確定拠出年金）と衝突していた。
 *    段階はラベルの文字で伝わるので、色はすべてニュートラルにする。
 *    → src/lib/utils/chipVariant.ts
 *
 * ⚠️ かつて `components/companies/CompanyCardCompact.tsx` に**別実装の getStageCfg**
 *    があったが、**そのファイルごと 2026-08-28 に削除した**（描画元が無い孤児だった）。
 *    いま別実装は無い。**増やさないこと。**
 */
export type StageCfgEntry = {
  label: string;
  color: string;
  bg: string;
  border: string;
  fontWeight?: number;
};

const NEUTRAL = { color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" };

/**
 * phase 値をバッジ表示設定に変換する。
 * マスタに無い値（過去の自由記述など）は null を返しバッジを非表示にする。
 *
 * ⚠️ **null を「—」やダミーのラベルに置き換えないこと。**
 *    値が無いことを、ある値に見せない（CLAUDE.md「データ表示の原則」）。
 */
export function getStageCfg(stage: string | null | undefined): StageCfgEntry | null {
  if (!stage) return null;
  const opt = PHASE_OPTIONS.find((o) => o.value === stage);
  if (!opt) return null;
  /* ⚠️ 太字にするのは親（スタートアップ / 上場企業 / 非上場）だけ。
        子（各ラウンド・各市場）は同じ重さにして、階層だけを伝える。 */
  return { label: opt.label, ...NEUTRAL, ...(opt.parent ? {} : { fontWeight: 800 }) };
}
