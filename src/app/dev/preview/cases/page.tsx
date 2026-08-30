import CustomerCasesClient from "@/app/(jobseeker)/companies/[id]/CustomerCasesClient";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { CASES_1, CASES_3, CASES_4, CASES_8, CASES_EDGE } from "../fixtures";

/**
 * 導入事例のプレビュー（2026-08-30）。
 *
 * ⚠️ 実データを持つのは **89社中3社**だけで、しかも 2026-08-13 に
 *    「1社あたり3件を基本とする」と決めたので、**4件目の境界を実データでは踏めない。**
 *
 * ⚠️ 境界は CLAUDE.md「`customer_cases` の書き方」に 1280px の実測で書いてある。
 *    **数字を測り直す前にそちらを読むこと。**
 *
 * ⚠️★**実ページと同じ呼び方をすること。** 企業ページは
 *    `defaultCollapsed={detail.customer_cases!.length > 3}` を渡している。
 *    渡さないと `showAll` が最初から true になり、**折りたたみが一度も出ない。**
 *    2026-08-30 に実際にそう作ってしまい、「CLAUDE.md の記述と食い違う」と誤読しかけた。
 *    **プレビューが実ページと違う呼び方をすると、何も検証していないことになる。**
 */

/** 企業ページと同じ既定（`companies/[id]/page.tsx:772`）。ここを実ページとずらさない */
const collapsedLikeProd = (n: number) => n > 3;
export default function CasesPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="導入事例">
        企業詳細の <code>CustomerCasesClient</code> です。
        初期表示は <strong>3件</strong>（<code>INITIAL_CASES</code>）で、
        <strong>4件目から折りたたみ</strong>が挟まります。
      </PreviewHeader>

      <Variant label="1件" note="折りたたみは出ない">
        <CustomerCasesClient cases={CASES_1} defaultCollapsed={collapsedLikeProd(CASES_1.length)} />
      </Variant>

      <Variant label="3件（上限ちょうど）" note="⚠️ ここまでは折りたたみ無しで全件読める。1社あたりの推奨件数">
        <CustomerCasesClient cases={CASES_3} defaultCollapsed={collapsedLikeProd(CASES_3.length)} />
      </Variant>

      <Variant label="4件（境界）" note="⚠★ここから「すべての導入事例を見る（残り N 社）」が挟まり、フェードで最後のカードが隠れる">
        <CustomerCasesClient cases={CASES_4} defaultCollapsed={collapsedLikeProd(CASES_4.length)} />
      </Variant>

      <Variant label="8件" note="⚠️ 展開後の長さ。Salesforce の実データがこの規模（展開後 約1,400px）">
        <CustomerCasesClient cases={CASES_8} defaultCollapsed={collapsedLikeProd(CASES_8.length)} />
      </Variant>

      <Variant
        label="崩れの確認（products 4つ / 長い usecase / products 空）"
        note="⚠️ 4つ目の products は独立行になりカードが約37px 高くなる。usecase 100字超は縦に伸びるだけのはず"
      >
        <CustomerCasesClient cases={CASES_EDGE} defaultCollapsed={collapsedLikeProd(CASES_EDGE.length)} />
      </Variant>

      <Variant label="0件" note="⚠️ 呼び出し側がセクションごと出さない前提。ここでは空配列を渡したときの挙動を見る">
        <CustomerCasesClient cases={[]} defaultCollapsed={collapsedLikeProd(0)} />
      </Variant>
    </div>
  );
}
