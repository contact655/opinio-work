import { devOnly } from "../guard";
import { PreviewHeader } from "../Variant";
import { PeopleFilterDemo } from "./Demo";

/**
 * /people の「すべてのフィルター」（2026-11-12）。PC は右から、767px 以下は下から出る。
 * ⚠️ DB を読まない。条件は画面の中だけで持つ。
 */
export default function PeopleFiltersPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="ユーザーフィルター（/people）">
        「すべてのフィルター」を押すと開くパネル（<code>PeopleFilterDrawer</code>）。リセット・結果を表示・✕・背景・Esc で閉じる。
      </PreviewHeader>
      <PeopleFilterDemo />
    </div>
  );
}
