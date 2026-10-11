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
        <p>企業から・個人からの最初のメッセージは「未返信のメッセージ」1行にまとめて出す（2026-10-11）。</p>
      </PreviewHeader>
      <Variant label="3種類とも届いている" note="提案・未返信のメッセージ（1＋3＝4件）">
        <InboxCard proposals={2} messageRequests={1} approaches={3} />
      </Variant>
      <Variant label="企業からだけ" note="未返信のメッセージ 1件">
        <InboxCard proposals={0} messageRequests={0} approaches={1} />
      </Variant>
    </div>
  );
}
