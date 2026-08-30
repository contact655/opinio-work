import { ProductsClientsSection } from "@/components/companies/ProductsClientsSection";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import {
  detailWith, PRODUCTS_1, PRODUCTS_2, PRODUCTS_5, PRODUCTS_8, PRODUCTS_EDGE,
  CUSTOMERS_7, CASES_3,
} from "../fixtures";

/**
 * 製品・導入事例セクションのプレビュー（2026-08-31）。
 *
 * ⚠️ 実データは **主要製品あり17社 / 導入事例あり3社 / 主な顧客あり数社**（2026-08-30 実測）。
 *
 * ⚠️★**`main_customers` は `customer_cases` があると表示されない**フォールバック構造。
 *    Salesforce は事例8件を持つため、DB にある「トヨタ自動車 / ソフトバンク /
 *    楽天グループ」は**画面に一度も出ていない**（CLAUDE.md）。
 *    ここでは「事例あり」「事例なし」の両方を並べて、その分岐を目で確かめる。
 */
export default function ProductsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="製品・導入事例">
        企業詳細の <code>ProductsClientsSection</code> です。
        製品の初期表示は <strong>5件</strong>、900px 以上では
        <strong>固定幅 183px × min(全件, 5) 列</strong>に並びます。
      </PreviewHeader>

      <Variant label="すべて空" note="⚠️ セクションごと出ないこと">
        <ProductsClientsSection detail={detailWith({})} />
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（何も描画されない ← これが正しい）</p>
      </Variant>

      <Variant label="1製品" note="⚠️ 375px で全幅カードにならないこと（2列固定のはず）">
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_1 })} />
      </Variant>

      <Variant
        label="2製品（右側が空く）"
        note="⚠️★CLAUDE.md の記録: 1440px で 374px しか埋まらず約6割が空白。仕様どおりか目で判断する"
      >
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_2 })} />
      </Variant>

      <Variant label="5製品（上限ちょうど）" note="900px で1行に収まる。「すべて見る」は出ない">
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_5 })} />
      </Variant>

      <Variant label="8製品（境界）" note="⚠️ 6件目から「すべて見る（残り 3）」が挟まる">
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_8 })} />
      </Variant>

      <Variant label="括弧なし / 極端に長い名前・説明" note="⚠️ 1行に収まらないときの省略。カードが横に伸びないか">
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_EDGE })} />
      </Variant>

      <Variant
        label="主な顧客7社（事例なし）"
        note="⚠️ customer_cases が空のときだけ出るフォールバック"
      >
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_2, main_customers: CUSTOMERS_7 })} />
      </Variant>

      <Variant
        label="主な顧客7社 ＋ 導入事例3件"
        note="⚠️★事例があると顧客リストは出ない。Salesforce の7社が画面に一度も出ていないのがこの形"
      >
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_2, main_customers: CUSTOMERS_7, customer_cases: CASES_3 })} />
      </Variant>
    </div>
  );
}
