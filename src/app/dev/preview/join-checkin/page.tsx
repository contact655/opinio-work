import { PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { JoinCheckinDemo } from "./Demo";

/**
 * 入社後のふり返り（入社3か月・1年。2026-11-20）。
 * ⚠️ migration（supabase/pending/20261120090000_join_checkins.sql）を当てるまで実データでは開けないので、ここで見る。
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
