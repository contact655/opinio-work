import { FeaturedConsultantsRail } from "@/components/people/FeaturedConsultantsRail";
import type { ConsultantCard } from "@/lib/featuredConsultants/server";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 相談可能なユーザー（/people の左サイドバー）のプレビュー（2026-11-12）。
 * ⚠️ 実データは表を作った直後は0人。**出る側はこの画面でしか踏めない。**
 * ⚠️ DB を読まない。固定データだけ。相談のボタンは押せない見本にしてある。
 * ⚠️ サイドバーの幅（240px）の箱に入れて並べる。狭い画面ではサイドバーごと畳まれる（PeopleSidebar）。
 */
const c = (i: number, o: Partial<ConsultantCard> = {}): ConsultantCard => ({
  userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, profileKey: `sample-${i}`,
  name: "山田 太郎", avatarUrl: null, currentCompany: "Salesforce", currentRole: "アカウントエグゼクティブ", isCurrent: true,
  talkTags: ["newcomer_rampup", "interview"], message: "人材業界の法人営業から外資SaaSに移りました。転職の進め方を一緒に考えます。",
  ...o,
});
const W = ({ children }: { children: React.ReactNode }) => <div style={{ width: 240, maxWidth: "100%" }}>{children}</div>;

export default function ConsultantsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="相談可能なユーザー">
        ホームの右の列の「相談可能なユーザー」（<code>FeaturedConsultantsRail</code>）です。0人なら何も出ません。
      </PreviewHeader>
      <Variant label="ホームの右の列（3人・幅300px。本物はサーバーが3人に絞る）">
        <div style={{ width: 300, maxWidth: "100%" }}><FeaturedConsultantsRail sample items={[
          c(1, { name: "柴 久人", currentCompany: null, currentRole: null, talkTags: ["role_change", "resume"], message: "キャリア全般の相談にのります。" }),
          c(2, { name: "福永 陽貴" }),
          c(3, { name: "木村 雅樹", currentCompany: "株式会社とても長い会社名のサンプルホールディングスジャパン" }),
        ]} /></div>
      </Variant>
      <Variant label="0人（何も出ない）">
        <W><FeaturedConsultantsRail items={[]} sample /></W>
      </Variant>
    </div>
  );
}
