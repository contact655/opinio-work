import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { ScoutList, type ScoutRow } from "@/app/biz/scouts/ScoutList";

/**
 * スカウト履歴（/biz/scouts）の一覧のプレビュー（2026-09-22）。
 * ⚠️ 本番は ow_scouts が0件で、送信も止めてある。行の見た目はここでしか見られない。
 * ⚠️ DB は読まない（固定データだけ）。
 */

const LONG = "はじめまして。サンプル株式会社の採用担当です。\nこれまでのSaaS営業でのご経験を拝見し、ぜひ一度お話しできればと思いご連絡しました。\n\n当社では現在、エンタープライズ向けの新規開拓チームを立ち上げており、裁量の大きい環境で事業づくりに関わっていただけます。まずはカジュアルにお話しできれば嬉しいです。";

function row(id: string, over: Partial<ScoutRow>): ScoutRow {
  return {
    id, status: "sent", sentAt: "2026-09-20T01:00:00Z", repliedAt: null, conversationId: null,
    message: "短い本文です。", jobTitle: null, jobId: null,
    candidate: { id: "u" + id, name: "山田 花子", avatar_color: null }, emailUndelivered: false, ...over,
  };
}

const ROWS: ScoutRow[] = [
  row("1", { status: "interested", message: LONG, jobTitle: "アカウントエグゼクティブ", repliedAt: "2026-09-21T03:00:00Z", conversationId: "c1" }),
  row("2", { status: "read", candidate: { id: "u2", name: "佐藤 次郎", avatar_color: null } }),
  row("3", { status: "sent", emailUndelivered: true, candidate: { id: "u3", name: "鈴木 一", avatar_color: null } }),
  row("4", { status: "declined", sentAt: "2025-12-10T01:00:00Z", repliedAt: "2025-12-12T01:00:00Z", candidate: null }),
];

export default function ScoutsPreviewPage() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="スカウト履歴（/biz/scouts）">
        見るところ：色が付くのは「興味あり」だけ／「相手が未読」「相手が既読」／年つきの日付／
        「全文を見る」で本文が開き「閉じる」に変わること／退会などで引けない人が「表示できない候補者」になること。
      </PreviewHeader>
      <Variant label="4状態（興味あり・既読・未読＋メール未達・辞退＋引けない人）" note="⚠️ 左の色帯が無いこと。辞退の行は年をまたいだ日付（2025年）">
        <div style={{ maxWidth: 860 }}>
          <ScoutList rows={ROWS} />
        </div>
      </Variant>
      <Variant label="絞り込んで0件" note="⚠️ 枠の中に「この条件のスカウトはありません。」">
        <div style={{ maxWidth: 860 }}>
          <ScoutList rows={[]} />
        </div>
      </Variant>
    </div>
  );
}
