import { ApproachBubble } from "@/components/approaches/ApproachBubble";
import { Variant, PreviewHeader } from "../Variant";
import { devOnly } from "../guard";

/**
 * 送ったメッセージの吹き出し（候補者を探すの右欄・/biz/messages のカード）（2026-10-11）。
 * ⚠️ 実データで踏めるのは「返信待ち」1件だけ（2026-10-11）。返信あり・30日経過・長文はここで見る。
 * ⚠️★この配下で DB を読まないこと。固定データだけを渡す。
 */
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();
const SHORT = "（検証）フィールドセールスとして長く法人営業をされてきた経験が、当社の営業体制づくりに活きると考えご連絡しました。";
const LONG = "（検証）製造業向けのエンタープライズ営業を長く担当され、導入から定着まで一貫して伴走されてきたご経験を拝見しました。当社はいま、大手の製造業のお客様向けに営業の体制を一から作り直しているところで、まさに現場に入り込んで意思決定まで伴走できる方を探しています。";
const BODY = "もしご関心があれば、30分ほどオンラインでお話しできればうれしいです。\n選考ではなく、まずはお互いを知る場として考えています。";

export default function Page() {
  devOnly();
  const box = { maxWidth: 560, padding: "16px 20px", border: "1px dashed var(--line)" } as const;
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 80px" }}>
      <PreviewHeader title="送ったメッセージの吹き出し">
        「送った人」「送った理由」のラベルを出さない。最初の行は「〇〇が◯月◯日 HH:MMに送信」、最後の行は状態（バッジにしない）。
      </PreviewHeader>
      <Variant label="返信待ち" note="最後の行が「返信を待っています（あと〇日）」">
        <div style={box}><ApproachBubble senderName="柴久人" sentAt={daysAgo(0)} reason={SHORT} body={null} status="pending" /></div>
      </Variant>
      <Variant label="返信あり" note="返信の冒頭（2行まで）と「メッセージを開く」">
        <div style={box}><ApproachBubble senderName="柴久人" sentAt={daysAgo(3)} reason={SHORT} body={null} status="accepted"
          reply={{ excerpt: "ご連絡ありがとうございます。ちょうど次のキャリアを考えていたところでした。来週でしたらお時間を合わせられますので、候補日をいくつかいただけますか。", href: "/biz/messages" }} /></div>
      </Variant>
      <Variant label="35日前に送って返信なし" note="期限は無い（2026-10-18）。最後の行は「返信を待っています」のまま。残り日数は出さない">
        <div style={box}><ApproachBubble senderName="柴久人" sentAt={daysAgo(35)} reason={SHORT} body={null} status="pending" /></div>
      </Variant>
      <Variant label="本文が長い（理由＋本文・求人つき）" note="4行で切れて「続きを読む」。押すとその場で全文">
        <div style={box}><ApproachBubble senderName="柴久人" sentAt={daysAgo(1)} jobTitle="エンタープライズ営業" reason={LONG} body={BODY} status="pending" /></div>
      </Variant>
    </div>
  );
}
