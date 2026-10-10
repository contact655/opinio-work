import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { InboxCard } from "@/components/mypage/InboxCard";

/**
 * ★/mypage の「届いているもの」（2026-10-11）。
 * ⚠️ DB は読まない。実データでは「個人から」と「企業から」が同時に揃わないので、ここで並べて見る。
 */
export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="届いているもの（/mypage）">
        <p>同じ「メッセージリクエスト」が2行並ぶので、「企業から」「個人から」の印で区別できるかを見る。</p>
      </PreviewHeader>
      <Variant label="3種類とも届いている" note="提案・個人から・企業から">
        <InboxCard proposals={2} messageRequests={1} approaches={3} />
      </Variant>
      <Variant label="企業からだけ" note="印は「企業から」">
        <InboxCard proposals={0} messageRequests={0} approaches={1} />
      </Variant>
    </div>
  );
}
