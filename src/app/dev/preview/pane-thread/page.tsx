import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { PaneThreadDemo } from "./PaneThreadDemo";

/**
 * ★候補者を探すの右欄のメッセージ欄（2026-10-12）。直近10通＋上へスクロールで前の10通。
 * ⚠️ 実データは数通しか無く、前を読み込む動きを描けない。ここで見る。DB は読まない。
 */
export default function Page() {
  devOnly();
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 80px" }}>
      <PreviewHeader title="右欄のメッセージ欄（直近10通・上へスクロールで前の10通）">
        最新が見える位置（いちばん下）で開く。上へスクロールすると前の10通を足し、表示位置は飛ばない。最初の1通まで来たら上端に「ここからやり取りが始まりました」。
      </PreviewHeader>
      <Variant label="30通（高さ 420px）" note="上へスクロールで 30 → 20 → 10 と読み込む。日付が変わるところに中央の小さな日付。候補者側に頭文字の丸">
        <PaneThreadDemo total={30} height={420} />
      </Variant>
      <Variant label="4通（10通未満）" note="最初から上端に「ここからやり取りが始まりました」。中身が少ないので欄も低い">
        <PaneThreadDemo total={4} height={420} />
      </Variant>
    </div>
  );
}
