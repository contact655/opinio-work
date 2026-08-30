import ToolsSectionClient from "@/app/(jobseeker)/companies/[id]/ToolsSectionClient";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { TOOLS_1, TOOLS_5_GROUPS, TOOLS_MANY } from "../fixtures";

/**
 * ツールのプレビュー（2026-08-30）。
 *
 * ⚠️ 実データは **1社しかツールを持たない**（Salesforce）。
 *    CLAUDE.md「⑥ ツール・技術スタックは取材でしか埋まらない項目」。
 *    グループが増えたときの見え方を実データでは確かめられない。
 *
 * ⚠️ DB のカテゴリは10種だが、表示は**5グループに束ねる**。
 *    グループとカテゴリが1対1のとき（AI・その他）はカテゴリ名を省略する。
 */
export default function ToolsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="ツール">
        企業詳細と求人詳細が共有する <code>ToolsSectionClient</code> です。
        カテゴリ10種を<strong>5グループ</strong>に束ねて表示します。
      </PreviewHeader>

      <Variant label="0件" note="⚠️ null を返す（呼び出し側がセクションごと出さない）">
        <ToolsSectionClient tools={[]} />
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（何も描画されない ← これが正しい）</p>
      </Variant>

      <Variant label="1件" note="グループが1つだけ。「すべて見る」は出ないはず">
        <ToolsSectionClient tools={TOOLS_1} />
      </Variant>

      <Variant label="8件・複数グループ" note="⚠️ グループが3つを超えると「すべて見る（残り N）」が挟まる">
        <ToolsSectionClient tools={TOOLS_5_GROUPS} />
      </Variant>

      <Variant label="30件" note="⚠️ グループ内が増えたとき。縦に伸びるだけか、カードが潰れないか">
        <ToolsSectionClient tools={TOOLS_MANY} />
      </Variant>
    </div>
  );
}
