import { PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { JoinCheckinDemo } from "./Demo";

/**
 * 入社後のふり返り（入社3か月・1年。2026-11-20）。
 * 実データでは条件に合う人（在籍中で入社3か月以上）が少ないので、ここで見る。
 *    DB には読みも書きもしない。
 */
export default function JoinCheckinPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="入社後のふり返り（入社3か月・1年）">
        ホームのカードから開くモーダル。合っているか・入社前の話との差（必須）→ 職場の実態・主に向き合う相手（任意）→ 傾向。
      </PreviewHeader>
      <JoinCheckinDemo />
    </div>
  );
}
