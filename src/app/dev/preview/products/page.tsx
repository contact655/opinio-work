import { ProductsClientsSection } from "@/components/companies/ProductsClientsSection";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import {
  detailWith, PRODUCTS_1, PRODUCTS_2, PRODUCTS_5, PRODUCTS_8, PRODUCTS_EDGE,
  CUSTOMERS_7, CASES_3,
  SALES_TARGETS_1, SALES_TARGETS_3, SALES_TARGETS_5, SALES_TARGETS_7, SALES_TARGETS_EDGE,
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
 *
 * ⚠️★**「主な営業先」は「主な顧客」とは別の項目**（2026-09-03 追加）。
 *    顧客そのもの（企業名）ではなく、**顧客企業の中のどの部署に売るか**。
 *    `customer_cases` の有無で出し分け**ない**ので、事例があっても隠れない。
 *    実データは **株式会社Opinio 1社・3件のみ**なので、上限（5件）・超過・長文は
 *    **この画面でしか踏めない。**
 */
export default function ProductsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="製品・導入事例">
        企業詳細の <code>ProductsClientsSection</code> です。
        製品の初期表示は <strong>5件</strong>、900px 以上では
        <strong>固定幅 183px × min(全件, 5) 列</strong>に並びます。
        <strong>主な営業先</strong>も同じカード・同じ上限です（⚠️ ただし
        <strong>主な顧客とは別の項目</strong>で、導入事例があっても隠れません）。
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

      {/* ── 主な営業先（2026-09-03 追加）── */}

      <Variant
        label="主な営業先3部門（本番と同じ）"
        note="⚠️ 株式会社Opinio の実データ。カードは主な製品と同じ 183px × 72px のはず"
      >
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_1, main_sales_targets: SALES_TARGETS_3 })} />
      </Variant>

      <Variant
        label="主な営業先だけ（製品なし・顧客なし）"
        note="⚠️★これだけでセクションが出ること。グリッドの style タグは製品ブロックの外に置いてある"
      >
        <ProductsClientsSection detail={detailWith({ main_sales_targets: SALES_TARGETS_1 })} />
      </Variant>

      <Variant label="主な営業先5部門（上限ちょうど）" note="900px で1行。「すべて見る」は出ない">
        <ProductsClientsSection detail={detailWith({ main_sales_targets: SALES_TARGETS_5 })} />
      </Variant>

      <Variant label="主な営業先7部門（境界）" note="⚠️ 6件目から「すべて見る（残り 2）」が挟まる">
        <ProductsClientsSection detail={detailWith({ main_sales_targets: SALES_TARGETS_7 })} />
      </Variant>

      <Variant label="長い部署名・括弧つき" note="⚠️ 1行に収まらないときの省略。カードが横に伸びないか">
        <ProductsClientsSection detail={detailWith({ main_sales_targets: SALES_TARGETS_EDGE })} />
      </Variant>

      <Variant
        label="営業先 ＋ 顧客 ＋ 事例（全部）"
        note="⚠️★営業先は customer_cases の有無に関係なく出る。顧客リストだけが事例に隠れる"
      >
        <ProductsClientsSection detail={detailWith({ main_products: PRODUCTS_2, main_sales_targets: SALES_TARGETS_3, main_customers: CUSTOMERS_7, customer_cases: CASES_3 })} />
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
