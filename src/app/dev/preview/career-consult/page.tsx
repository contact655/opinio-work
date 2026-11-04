import { devOnly } from "../guard";
import { PreviewHeader } from "../Variant";
import { CareerConsultSamples } from "./Samples";

/**
 * キャリア相談の見本（2026-11-05）。最初の1通の画面・チャットの中のカード・共通点。
 * ⚠️ DB を読まない。固定データだけ。送る操作は見本では押せない（sample）。
 */
export default function CareerConsultPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="キャリア相談">
        個人どうしのメッセージの最初の1通（<code>NewMessageComposer</code>）と、チャットの中の相談のカード（<code>ConsultCard</code>）です。
        相談テーマは選ばなくても送れます。選ぶと「特に聞きたいこと」「希望する話し方」「ひとこと」が開きます。
      </PreviewHeader>
      <CareerConsultSamples />
    </div>
  );
}
