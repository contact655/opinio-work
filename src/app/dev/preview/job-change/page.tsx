import { PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { JobChangeDemo } from "./Demo";

/**
 * 現職の会社名を変えたときの「転職しましたか？／会社名の修正ですか？」（2026-11-04）。
 * ⚠️ 本番のデータでは出しにくい（現職の会社名を変える必要がある）ので、見た目はここで見る。DB には読みも書きもしない。
 */
export default function JobChangePreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="現職の会社名を変えたとき（転職／会社名の修正）">
        役割の行の鉛筆（職歴の編集）と会社の行の鉛筆（会社名の変更）の両方で、保存の前に1回だけ出る。
        「転職しました」は辞めた月を聞いてから、新しい会社の「職歴を追加」を開く。
      </PreviewHeader>
      <JobChangeDemo />
    </div>
  );
}
