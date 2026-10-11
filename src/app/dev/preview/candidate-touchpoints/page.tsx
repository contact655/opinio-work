import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { TouchpointSection } from "@/app/biz/candidates/CandidatePreview";
import type { Touchpoint } from "@/lib/business/candidates/model";

/**
 * ★候補者検索の「〈会社名〉と合うところ」（2026-10-10 / 候補者探し 段1。2026-10-11 に名前を改めた）。
 * ⚠️ 実データは材料（求人・自社の職種・公開している社員）がほとんど無く、出る側を描けない。ここで見る。
 * ⚠️ DB は読まない（固定データ）。
 */
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
      <PreviewHeader title="〈会社名〉と合うところ（/biz/candidates の右のプレビュー）">
        <p>2026-10-11 に「貴社との接点」から改めた。強い順に3つまで。4つ以上は「ほかに N件」。（〇）は項目の数。0件・取得失敗は見出しごと出さない。</p>
      </PreviewHeader>
      <Variant label="0件" note="見出しごと出ない（何も描かれないのが正しい）">
        <TouchpointSection touchpoints={[]} companyShortName="Third Box" />
      </Variant>
      <Variant label="2件" note="「Third Boxと合うところ（2）」。「ほかに」は出ない">
        <TouchpointSection touchpoints={two} companyShortName="Third Box" />
      </Variant>
      <Variant label="5件" note="（5）・3件と「ほかに2件」。押すと全部">
        <TouchpointSection touchpoints={five} companyShortName="Third Box" />
      </Variant>
      <Variant label="会社名が取れない" note="「貴社と合うところ（2）」">
        <TouchpointSection touchpoints={two} companyShortName={null} />
      </Variant>
      <Variant label="取得に失敗（undefined）" note="欄ごと出さない（0件と言わない）">
        <TouchpointSection touchpoints={undefined} companyShortName="Third Box" />
      </Variant>
    </div>
  );
}
