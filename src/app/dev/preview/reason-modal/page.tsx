import { PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { ReasonModalDemo, TendencyGallery } from "./Demo";

/**
 * 入社後レビュー「株式会社◯◯について」（2026-10-16 に作り直した）。
 *
 * ⚠️ 実画面では「①まで答えて閉じた」「④の4パターン」を狙って作れないのでここで見る。
 * ⚠️ モーダルは画面いっぱいに重なるので、ボタンで1つずつ開く。DB には読みも書きもしない。
 * ⚠️ 幅はブラウザ自体をリサイズして見る（モーダルの幅は 600px・狭い画面では 96vw）。
 */
export default function ReasonModalPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="入社後レビュー（株式会社◯◯について）">
        職歴の行の吹き出しアイコン・職歴を追加した直後・「まとめて答える」から開くモーダル。下に④の4パターンを並べてある。
      </PreviewHeader>
      <ReasonModalDemo />
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "28px 0 12px" }}>④ あなたが合う職場の傾向（4パターン）</h2>
      <TendencyGallery />
    </div>
  );
}
