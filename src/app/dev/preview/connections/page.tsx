import { CompanyConnectionsView, type ConnectionView } from "@/components/companies/CompanyConnections";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 企業ページの「この会社に、あなたのつながりがいます」のプレビュー（2026-10-16 / フェーズ3）。
 * ⚠️ 実データは相互フォローが0組（2026-10-16 実測）。**出る側はこの画面でしか踏めない。**
 * ⚠️ DB を読まない。固定データだけ。
 */
const person = (i: number, name: string, avatarUrl: string | null = null): ConnectionView => ({
  userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, name, avatarUrl, avatarInitial: name.charAt(0),
});
const ONE = [person(1, "山田 太郎")];
const THREE = [person(1, "山田 太郎"), person(2, "佐藤 花子"), person(3, "Alexander Johnson")];
const MANY = Array.from({ length: 14 }, (_, i) => person(i + 1, ["山田 太郎", "佐藤 花子", "鈴木 一郎", "高橋 美咲", "田中 健"][i % 5] + (i + 1)));
const LONG = [person(1, "寿限無寿限無五劫のすりきれ海砂利水魚の水行末雲来末風来末食う寝る処に住む処"), person(2, "佐藤 花子")];

export default function ConnectionsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="つながり（企業ページ）">
        企業ページの <code>CompanyConnectionsView</code> です。閲覧者と相互フォローで、その会社に在籍中・
        <strong>表示を許可した人だけ</strong>が出ます。0人なら何も出ません。
      </PreviewHeader>
      <Variant label="0人" note="⚠️ 何も描画されないこと">
        <CompanyConnectionsView connections={[]} />
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（何も描画されない ← これが正しい）</p>
      </Variant>
      <Variant label="1人"><CompanyConnectionsView connections={ONE} /></Variant>
      <Variant label="3人（英字名を含む）"><CompanyConnectionsView connections={THREE} /></Variant>
      <Variant label="14人（折り返し）"><CompanyConnectionsView connections={MANY} /></Variant>
      <Variant label="長い名前" note="⚠️ はみ出さず省略されること（title で全文）"><CompanyConnectionsView connections={LONG} /></Variant>
    </div>
  );
}
