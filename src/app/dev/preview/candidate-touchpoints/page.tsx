import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { TouchpointSection } from "@/app/biz/candidates/CandidatePreview";
import type { Touchpoint, TouchpointMaterials } from "@/lib/business/candidates/model";

/**
 * ★候補者検索の「貴社との接点」（2026-10-10 / 候補者探し 段1）。
 * ⚠️ 実データは材料（求人・自社の職種・公開している社員）がほとんど無く、出る側を描けない。ここで見る。
 * ⚠️ DB は読まない（固定データ）。
 */
const none: TouchpointMaterials = { hasJobs: false, hasCompanyRoles: false, hasPublicEmployees: false };
const all: TouchpointMaterials = { hasJobs: true, hasCompanyRoles: true, hasPublicEmployees: true };
const tp = (kind: Touchpoint["kind"], text: string, weight: number): Touchpoint => ({ kind, text, weight, ref: null });
const two = [
  tp("job_role", "求人『法人営業（SaaS）』と同じ職種の経験があります（経験5年）", 5),
  tp("location", "求人の勤務地（東京都）とお住まいが合っています", 1),
];
const five = [
  tp("job_role", "求人『法人営業（SaaS）』と同じ職種の経験があります（経験5年）", 5),
  tp("company_role", "部門『関西営業部』の職種と、関心のある職種が合っています", 4),
  tp("alumni", "株式会社サンプルテックの出身者が、貴社に2名在籍しています", 3),
  tp("target_industry", "貴社の顧客の業界（製造業）での経験があります", 3),
  tp("business_domain", "同じ事業領域（CRM・営業支援・マーケティング）の会社での経験があります", 2),
];

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="貴社との接点（/biz/candidates の右のプレビュー）">
        <p>強い順に3つまで。4つ以上は「ほかに N件」。空でも欄は消さない。</p>
      </PreviewHeader>
      <Variant label="0件・材料がまだ無い企業" note="1文と、足りない材料への入口（求人・部門と職種・社員）">
        <TouchpointSection touchpoints={[]} materials={none} />
      </Variant>
      <Variant label="0件・材料は揃っている企業" note="入口は出さず1文だけ（その候補者とだけ接点が無い）">
        <TouchpointSection touchpoints={[]} materials={all} />
      </Variant>
      <Variant label="2件" note="「ほかに」は出ない">
        <TouchpointSection touchpoints={two} materials={all} />
      </Variant>
      <Variant label="5件" note="3件と「ほかに2件」。押すと全部">
        <TouchpointSection touchpoints={five} materials={all} />
      </Variant>
      <Variant label="取得に失敗（undefined）" note="欄ごと出さない（0件と言わない）">
        <TouchpointSection touchpoints={undefined} materials={null} />
      </Variant>
    </div>
  );
}
