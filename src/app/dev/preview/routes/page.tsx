import { RouteHostCard, RouteHostGrid, type RouteHostCardData } from "@/components/careerRoutes/RouteHostCard";
import { ProfileRoutesSection } from "@/components/careerRoutes/ProfileRoutesSection";
import { ROUTE_VERIFIED_NOTE } from "@/lib/constants/careerRoutes";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 転職ルート（/routes/[slug]）と、プロフィールの「転職ルート」のプレビュー（2026-11-11）。
 * ⚠️ 実データは掲載できる経験者が0人（表を作った直後）。**出る側はこの画面でしか踏めない。**
 * ⚠️ DB を読まない。固定データだけ。相談のボタンは押せない見本にしてある。
 */
const ROUTE = { fromLabel: "人材の法人営業", toLabel: "外資SaaSの営業" };
const host = (i: number, o: Partial<RouteHostCardData> = {}): RouteHostCardData => ({
  userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, profileKey: `sample-${i}`,
  name: "山田 太郎", avatarUrl: null, currentCompany: "Salesforce", currentRole: "アカウントエグゼクティブ", isCurrent: true,
  movedYear: 2023, talkTags: ["newcomer_rampup", "interview", "foreign_eval_quota"], message: "人材業界の法人営業から、未経験で外資SaaSに移りました。最初の3か月で何をしたかをお話しできます。",
  ...o,
});
const LONG = host(9, {
  name: "寿限無寿限無五劫のすりきれ海砂利水魚の水行末雲来末風来末",
  currentCompany: "株式会社とても長い会社名のサンプルホールディングスジャパン", currentRole: "エンタープライズセールス",
  talkTags: ["newcomer_rampup", "interview", "resume", "salary_negotiation", "english", "foreign_eval_quota", "workstyle_remote", "role_change"],
  message: "あ".repeat(200),
});

export default function RoutesPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="転職ルート">
        ルートのページの経験者カード（<code>RouteHostCard</code>）と、プロフィールの「転職ルート」（<code>ProfileRoutesSection</code>）です。
        390px でもはみ出さないこと・ボタンが高さ44px以上であることを確かめます。
      </PreviewHeader>
      <Variant label="1人">
        <RouteHostGrid><RouteHostCard host={host(1)} {...ROUTE} sample /></RouteHostGrid>
        <p style={{ margin: "20px 0 0", fontSize: 13, color: "var(--ink-mute)" }}>{ROUTE_VERIFIED_NOTE}</p>
      </Variant>
      <Variant label="3人（会社名を伏せた人・転職した年が無い人・ひとことが無い人）">
        <RouteHostGrid>
          <RouteHostCard host={host(1)} {...ROUTE} sample />
          <RouteHostCard host={host(2, { name: "佐藤 花子", currentCompany: null, movedYear: null, talkTags: ["english"] })} {...ROUTE} sample />
          <RouteHostCard host={host(3, { name: "鈴木 一郎", message: null, isCurrent: false, currentRole: null })} {...ROUTE} sample />
        </RouteHostGrid>
      </Variant>
      <Variant label="長い名前・会社名・タグ8つ・ひとこと200字">
        <RouteHostGrid><RouteHostCard host={LONG} {...ROUTE} sample /></RouteHostGrid>
      </Variant>
      <Variant label="0人（準備中）">
        <p data-state="route-preparing" style={{ padding: "20px 16px", borderRadius: 12, background: "var(--bg-tint)", color: "var(--ink-soft)", fontSize: 15, textAlign: "center", margin: 0 }}>
          準備中です
        </p>
      </Variant>
      <Variant label="プロフィールの「転職ルート」（2ルート）">
        <ProfileRoutesSection user={{ id: host(1).userId, name: "山田 太郎" }} showConsult={false} items={[
          { route: { slug: "hr-sales-to-foreign-saas", ...ROUTE }, movedYear: 2023, talkTags: host(1).talkTags, message: host(1).message },
          { route: { slug: "jp-saas-to-foreign-saas", fromLabel: "日系SaaS", toLabel: "外資SaaS" }, movedYear: null, talkTags: [], message: null },
        ]} />
      </Variant>
    </div>
  );
}
