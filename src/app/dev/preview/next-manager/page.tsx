import { devOnly } from "../guard";
import { PreviewHeader } from "../Variant";
import { NextManagerSamples } from "./Samples";

/**
 * Next Manager の見本（2026-11-13）。採用中のバッジ・2人だけのものの一行・面談の記録・候補者管理。
 * ⚠️ DB を読まない。固定データだけ。保存・引き継ぎは押しても送らない（面談の記録は見本の印で止める）。
 */
export default function NextManagerPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="Next Manager">
        実データでは採用中のマネージャーもマッチングもまだ0件なので、出る側はここで見ます。
        候補者管理は「全件（管理者）」「自分の分だけ」「読み込み失敗」「0件」の4通りです。
      </PreviewHeader>
      <NextManagerSamples />
    </div>
  );
}
