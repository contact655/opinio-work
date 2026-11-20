import type React from "react";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { HomeProfileCard, type HomeProfileCardData } from "@/components/feed/HomeProfileCard";
import type { ProfileNextStepKey } from "@/lib/profile/nextStep";

/**
 * ホームの左の列のカード（2026-11-04）。実データでは職歴0件・長い社名・話せる量の各値がそろわないので、ここで見る。
 * ⚠️ DB を読まない。固定データだけ。
 * 何を見るか: 顔写真が帯にかかる／肩書きが1行で切れる／職歴0件で「職歴を入れる」／話を聞けるの3つの値／取れないとき行ごと出ない
 *   ／次の1件（2026-11-04）: 5つの文言・職歴0件と全部埋まったときに出ない
 */
const base: HomeProfileCardData = {
  me: {
    userId: "00000000-0000-0000-0000-000000000001", name: "木村 翼", avatarUrl: null,
    gradient: "linear-gradient(135deg, #002366, #3B5FD9)", initial: "木",
    affiliation: null, roleName: "インサイドセールス", companyLabel: "関西の SaaS 企業",
  },
  counts: { following: 3, followers: 0, companies: 12, savedJobs: 1, starredBy: 2 },
  experienceCount: 2,
  nextStepKey: "photo",
};

const NEXT_KEYS: ProfileNextStepKey[] = ["photo", "education", "school", "headline", "about"];

/** ★ホームの左の列と同じ幅（2026-11-04 から 225px。FeedClient の HOME_LEFT_WIDTH） */
function Col({ children }: { children: React.ReactNode }) {
  return <div style={{ width: 225 }}>{children}</div>;
}

export default function HomeLeftCardPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="ホームの左の列のカード（/home・/search）">
        PC（1024px 以上）の左の列（幅 225px）。1023px 以下では出さない。
      </PreviewHeader>
      <Variant label="ふつう"><Col><HomeProfileCard {...base} /></Col></Variant>
      <Variant label="職歴0件（「職歴を入れる」）">
        <Col><HomeProfileCard {...base} me={{ ...base.me, roleName: null, companyLabel: null }} experienceCount={0} /></Col>
      </Variant>
      <Variant label="長い名前・長い職種と社名（1行で切れる）">
        <Col><HomeProfileCard {...base} me={{ ...base.me, name: "とても長い名前のユーザー 太郎", roleName: "カスタマーサクセスマネージャー", companyLabel: "とても長い会社名の株式会社エンタープライズソリューションズジャパン" }} /></Col>
      </Variant>
      <Variant label="あなたを気にしている企業: 0社 ／ 取得に失敗（行ごと出さない）">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Col><HomeProfileCard {...base} counts={{ ...base.counts, starredBy: 0 }} /></Col>
          <Col><HomeProfileCard {...base} counts={{ ...base.counts, starredBy: null }} /></Col>
        </div>
      </Variant>
      <Variant label="職歴はあるが現職が無い（肩書きの行を出さない）">
        <Col><HomeProfileCard {...base} me={{ ...base.me, roleName: null, companyLabel: null }} /></Col>
      </Variant>
      <Variant label="次の1件: 写真 → 学歴 → 学歴の学校を一覧から選ぶ → 肩書き → 自己紹介（5枚）">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {NEXT_KEYS.map((k) => <Col key={k}><HomeProfileCard {...base} nextStepKey={k} /></Col>)}
        </div>
      </Variant>
      <Variant label="次の1件: 全部埋まっている（行ごと出さない）／職歴0件（「職歴を入れる」だけ。次の1件は出さない）">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Col><HomeProfileCard {...base} nextStepKey={null} /></Col>
          <Col><HomeProfileCard {...base} me={{ ...base.me, roleName: null, companyLabel: null }} experienceCount={0} nextStepKey="career" /></Col>
        </div>
      </Variant>
    </div>
  );
}
