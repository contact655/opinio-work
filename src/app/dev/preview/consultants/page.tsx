import { FeaturedConsultantsCard } from "@/components/people/FeaturedConsultantsCard";
import type { ConsultantCard } from "@/lib/featuredConsultants/server";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 相談できる人（/people の左サイドバー）のプレビュー（2026-11-12）。
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
      <PreviewHeader title="相談できる人">
        /people の左サイドバーの「相談できる人」（<code>FeaturedConsultantsCard</code>）です。0人なら何も出ません。
      </PreviewHeader>
      <Variant label="1人">
        <W><FeaturedConsultantsCard items={[c(1)]} sample /></W>
      </Variant>
      <Variant label="4人（職歴が無い人・タグが無い人・ひとことが無い人・以前の職歴の人）">
        <W><FeaturedConsultantsCard sample items={[
          c(1, { name: "柴 久人", currentCompany: null, currentRole: null, talkTags: ["role_change", "resume"], message: "キャリア全般の相談にのります。" }),
          c(2, { name: "福永 陽貴", talkTags: [] }),
          c(3, { name: "木村 雅樹", message: null }),
          c(4, { name: "大塚 悠貴", isCurrent: false, currentCompany: "SmartHR", currentRole: "フィールドセールス" }),
        ]} /></W>
      </Variant>
      <Variant label="長い名前・会社名・タグ全部・ひとこと200字（3行で切る）">
        <W><FeaturedConsultantsCard sample items={[c(9, {
          name: "寿限無寿限無五劫のすりきれ海砂利水魚の水行末雲来末風来末",
          currentCompany: "株式会社とても長い会社名のサンプルホールディングスジャパン", currentRole: "エンタープライズセールス",
          talkTags: ["newcomer_rampup", "interview", "resume", "salary_negotiation", "english", "foreign_eval_quota", "workstyle_remote", "role_change"],
          message: "あ".repeat(200),
        })]} /></W>
      </Variant>
      <Variant label="0人（何も出ない）">
        <W><FeaturedConsultantsCard items={[]} sample /></W>
      </Variant>
    </div>
  );
}
