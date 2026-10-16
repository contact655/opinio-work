import { PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { ReasonModalDemo } from "./Demo";

/**
 * 「この会社について」モーダル（2026-10-16 / 新形式 reason_version = 2）。
 *
 * ⚠️ 実画面では「旧形式の回答がある会社」「3つ選んでいちばんが未選択」「長い社名」を狙って作れないのでここで見る。
 * ⚠️ モーダルは画面いっぱいに重なるので、ボタンで1つずつ開く。DB には読みも書きもしない。
 * ⚠️ 幅はブラウザ自体をリサイズして見る（モーダルの幅は 560px・狭い画面では 96vw）。
 */
export default function ReasonModalPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="この会社について（理由モーダル）">
        職歴の行の吹き出しアイコン・職歴を追加した直後・「まとめて答える」から開くモーダル。
      </PreviewHeader>
      <ReasonModalDemo />
    </div>
  );
}
