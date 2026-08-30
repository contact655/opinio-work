import { BenefitsList, BENEFIT_CATEGORY_LIMIT } from "@/components/companies/BenefitsList";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import {
  BENEFITS_WORKSTYLE_ONLY, BENEFITS_THREE_CATS, BENEFITS_ALL_CATS,
  BENEFITS_MONEY_EDGE, BENEFITS_LONG, BENEFITS_MANY,
} from "../fixtures";

/**
 * 福利厚生のプレビュー（2026-08-30）。
 *
 * ⚠️ 実データは **89社中2社**しか福利厚生を持たない。境界を実データでは踏めない。
 * ⚠️ 企業詳細・求人詳細の両方がこの `BenefitsList` を使う（2026-08-30 に統合）。
 *    **ここが正しければ両方が正しい。**
 */
export default function BenefitsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="福利厚生">
        企業詳細と求人詳細が共有する <code>BenefitsList</code> です。
        カテゴリ数が <strong>{BENEFIT_CATEGORY_LIMIT}</strong> を超えると
        「すべて見る」が挟まります（<strong>件数ではなくカテゴリ数</strong>で切ります）。
      </PreviewHeader>

      <Variant label="0件" note="⚠️ null を返す。空状態は各ページが自分で出す（この部品は何も描かない）">
        <BenefitsList benefits={[]} />
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（何も描画されない ← これが正しい）</p>
      </Variant>

      <Variant label="1カテゴリ・2件" note="すべて見るは出ない。右側が空くのが自然かどうか">
        <BenefitsList benefits={BENEFITS_WORKSTYLE_ONLY} />
      </Variant>

      <Variant label="3カテゴリ（上限ちょうど）" note="⚠️ ここまでは「すべて見る」が出ない">
        <BenefitsList benefits={BENEFITS_THREE_CATS} />
      </Variant>

      <Variant label="6カテゴリ（上限超え）" note="⚠️ 境界。「すべて見る（残り 3）」が出る。押すと その他 まで開く">
        <BenefitsList benefits={BENEFITS_ALL_CATS} />
      </Variant>

      <Variant
        label="色の役割（緑になってよいのは何か）"
        note="⚠️ 緑は 確定拠出年金 / 退職金 / SO / RSU / 持株 だけ。SOMPO・SODEXO・手当・祝い金は青のまま"
      >
        <BenefitsList benefits={BENEFITS_MONEY_EDGE} />
      </Variant>

      <Variant label="極端に長い文言" note="⚠️ 折り返してカードが縦に伸びるだけか。はみ出さないか">
        <BenefitsList benefits={BENEFITS_LONG} />
      </Variant>

      <Variant label="20件" note="⚠️ カテゴリ内が増えたとき。縦に伸びるだけで崩れないか">
        <BenefitsList benefits={BENEFITS_MANY} />
      </Variant>
    </div>
  );
}
