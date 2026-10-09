import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { DetailSearchHarness } from "./DetailSearchHarness";

/**
 * 詳細検索の入れ物（2026-10-09）。
 *
 * ⚠️★1024px 未満では右からのドロワー、以上ではページ内のパネルになる。**ブラウザの幅を変えて**見る。
 * ⚠️★件数が取れないとき「0」ではなく「—」が出ることを見る（実画面では API が落ちないので踏めない）。
 */
export default function DetailSearchPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="詳細検索（パネル／ドロワー）">
        1024px 未満では右からのドロワー、以上ではページ内のパネル。件数が取れないときは「—」。
      </PreviewHeader>
      <Variant label="件数の出方" note="開いて下のボタンの数字を見る。取れないときは「—」で、0 にならないこと。">
        <DetailSearchHarness />
      </Variant>
    </div>
  );
}
