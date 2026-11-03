import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import ForYouSection, { type ForYouView } from "@/app/(jobseeker)/mypage/proposals/ForYouSection";
import { PrevCareerSummary } from "@/components/people/PrevCareerSummary";
import CareerPromptDemo from "./CareerPromptDemo";
import type { PathsView } from "@/lib/paths/server";
import { CANDIDATE_DECLINE_REASONS } from "@/lib/constants/declineReasons";

/**
 * ホームの右の列とスマホの差し込み（2026-11-04）。実データではこの形がそろう利用者がいないので、ここで見る。
 * ⚠️ DB を読まない。固定データだけ。⚠️ ボタンを押すと本物の API を叩く（存在しない id なので 404 になる）。押さない
 * 何を見るか: 右の列（1024px 以上は 300px・768〜1023px は 340px）で社名・理由・ボタンがはみ出さない／折り返さないこと。「…」の中に 保存・あとで・興味なし
 */
const base: Omit<ForYouView, "id" | "rank" | "name"> = {
  href: null, logoUrl: null, tagline: "チームの作業を割り当て、進捗を追う", reasons: [], groupLabel: null, hasOpenJobs: false,
  phaseLabel: null, cautions: [], hasResponder: true, interestStatus: null, reaction: null, conversationId: null, interested: false,
};
const COMPANIES: ForYouView[] = [
  { ...base, id: "00000000-0000-0000-0000-000000000101", rank: 1, name: "サンプルワークス", href: "/companies/salesforce", reasons: ["前職と同じAI・データ領域の会社です"] },
  { ...base, id: "00000000-0000-0000-0000-000000000102", rank: 2, name: "とても長い会社名の株式会社エンタープライズソリューションズジャパン", reasons: ["あなたと同じ職種から、この会社へ 5人が移っています（理由が長いときは1行で切れること）"], hasResponder: false },
  { ...base, id: "00000000-0000-0000-0000-000000000103", rank: 3, name: "サンプル商事", reasons: [], interested: true, conversationId: "x" },
  { ...base, id: "00000000-0000-0000-0000-000000000104", rank: 4, name: "理由なしの株式会社サンプルテクノロジーズ", reasons: [] },
  { ...base, id: "00000000-0000-0000-0000-000000000105", rank: 5, name: "サンプルクラウド", reasons: ["同じ経歴から移った人が多く、前職と同じ事業領域で、職種も希望と合っている会社です（理由がとても長い）"] },
];
const PATHS: Pick<PathsView, "start" | "summary" | "wider"> = {
  start: { role: { slug: "sales", name: "営業" }, industry: { slug: "it", name: "IT・インターネット" }, company: null },
  summary: {
    moverCount: 23,
    company: [{ label: "Salesforce", count: 9, href: "/companies/salesforce", industryLabel: "IT・インターネット" }, { label: "とても長い会社名の株式会社エンタープライズソリューションズジャパン", count: 6, href: null, industryLabel: "コンサルティング" }],
    role: [{ label: "営業", count: 14, href: null }, { label: "カスタマーサクセス", count: 5, href: null }],
    industry: [{ label: "IT・インターネット", count: 18, href: null }],
  },
  wider: [],
};
const decline = CANDIDATE_DECLINE_REASONS.map((o) => ({ value: o.value, label: o.label }));

export default function HomeRailPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="ホームの右の列とスマホの差し込み（/home）">
        PC は右の列（1024px 以上は 300px）、スマホはタイムラインの2件目と3件目の間（横スクロール）・5件目のあと。
      </PreviewHeader>
      <Variant label="右の列（300px）: あなたに合う会社 → 行き先" note="社名・理由は列の幅いっぱいで1行で切れ、ボタンは3行目に並ぶこと。1社目ふつう・2社目は長い社名と理由で担当者未登録（保存）・3社目は答えた後・4社目は理由なし・5社目は長い理由">
        <div style={{ width: 300, maxWidth: "100%" }}>
          <ForYouSection companies={COMPANIES} loadFailed={false} noReasons={false} declineReasons={decline}
            compact={{ limit: 5, moreHref: "/mypage/proposals", title: "あなたに合う会社", layout: "rail" }} />
          <PrevCareerSummary view={PATHS} variant="rail" />
        </div>
      </Variant>
      <Variant label="スマホの横スクロール" note="カードは 240px。横にスクロールできること">
        <div style={{ maxWidth: 375 }}>
          <ForYouSection companies={COMPANIES} loadFailed={false} noReasons={false} declineReasons={decline}
            compact={{ limit: 3, moreHref: "/mypage/proposals", title: "あなたに合う会社", layout: "scroll" }} />
        </div>
      </Variant>
      <Variant label="職歴が0件の人の案内（右の列の一番上・スマホはページの一番上）" note="×で閉じると7日間出ない（この端末だけ。見本では閉じても記録しない）">
        <div style={{ width: 300, maxWidth: "100%" }}><CareerPromptDemo /></div>
      </Variant>
    </div>
  );
}
