import { Variant, PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { CareerPromptDemo } from "./Demo";

/**
 * 職歴の促しカード（2026-10-16）。/mypage の職歴欄に、職歴が現職1件だけの人へ出す。
 *
 * ⚠️ 実画面では「社名が長い」「伏せ字の会社」「保存に失敗」を描けないのでここで見る。
 * ⚠️ 幅はブラウザ自体をリサイズして見る（375px で3つのボタンが折り返す）。
 */
export default function CareerPromptPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="職歴の促しカード">
        <code>/mypage</code> の職歴欄。出ているあいだは「N件の職歴が未回答です」の帯を出しません。
      </PreviewHeader>
      <Variant label="ふつうの社名" note="ボタンは「{会社名}での異動・昇進を追加」「前職を追加」「これ以上の経歴はない」">
        <CareerPromptDemo companyName="Salesforce" />
      </Variant>
      <Variant label="長い社名" note="ボタンの中で折り返し、横にはみ出さないこと">
        <CareerPromptDemo companyName="株式会社セールスフォース・ジャパン・ホールディングス・インターナショナル" />
      </Variant>
      <Variant label="社名が出せない（伏せ字・不明）" note="「この会社での異動・昇進を追加」">
        <CareerPromptDemo companyName={null} />
      </Variant>
      <Variant label="「これ以上の経歴はない」の保存に失敗" note="押すとエラーが出て、カードは残る">
        <CareerPromptDemo companyName="Salesforce" fail />
      </Variant>
    </div>
  );
}
