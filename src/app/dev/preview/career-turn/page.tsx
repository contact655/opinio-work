import { PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { CareerTurnDemo } from "./Demo";

/**
 * 転機の3問（2026-10-27 / フェーズ1c）。入社後レビューのモーダルを置き換えた。
 *
 * ⚠️ 実画面では「最初の会社」「入社1年未満」「旧の決め手を写した会社」を狙って作れないのでここで見る。
 * ⚠️ モーダルは画面いっぱいに重なるので、ボタンで1つずつ開く。DB には読みも書きもしない。
 */
export default function CareerTurnPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="転機の3問（株式会社◯◯について）">
        職歴を追加した直後・職歴の行の吹き出しアイコン・「まとめて答える」から開くモーダル。保存すると「あなたが合う職場の傾向」が出る。
      </PreviewHeader>
      <CareerTurnDemo />
    </div>
  );
}
