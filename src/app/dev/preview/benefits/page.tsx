import { BenefitsList, BENEFIT_CATEGORY_LIMIT } from "@/components/companies/BenefitsList";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import {
  BENEFITS_WORKSTYLE_ONLY, BENEFITS_THREE_CATS, BENEFITS_ALL_CATS,
  BENEFITS_MONEY_EDGE, BENEFITS_LONG, BENEFITS_MANY,
  BENEFITS_WITH_DETAIL, BENEFITS_ALL_DETAIL,
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

      {/* ★詳細つき（2026-08-31 追加）。企業が `/biz/company` で任意に入力する。 */}
      <Variant
        label="詳細つき（一部の項目だけ）"
        note="⚠️★「?」が付いた2枚だけ押せる。ホバーでもタップでも開く。詳細の無い項目は押せないのが正しい"
      >
        <BenefitsList benefits={BENEFITS_WITH_DETAIL} />
      </Variant>

      <Variant
        label="詳細つき（長い詳細）"
        note="⚠️ 3枚目の詳細は 60字超。カードと同じ幅で折り返すので、縦にどれだけ伸びるかを見る"
      >
        <BenefitsList benefits={[BENEFITS_WITH_DETAIL[3]]} />
      </Variant>

      <Variant
        label="全件に詳細がある"
        note="⚠️「?」が並びすぎて煩くないか。実データではここまで揃うことは少ないはず"
      >
        <BenefitsList benefits={BENEFITS_ALL_DETAIL} />
      </Variant>
    </div>
  );
}
