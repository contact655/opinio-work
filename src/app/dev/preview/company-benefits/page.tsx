import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { BenefitTagsSection, WorkstyleSection, PROFILE_CSS } from "@/app/(jobseeker)/companies/[id]/CompanyProfileSections";
import type { Benefit } from "@/lib/companies/benefits";

/**
 * ★企業ページの「福利厚生」をカテゴリごとの表で出す形（2026-11-28）と、「働き方」への引き継ぎを見る。
 * ⚠️ 固定データだけ。DB を読まない。
 */
const SALESFORCE: Benefit[] = [
  { name: "フルフレックス制度", category: "workstyle" },
  { name: "リモートワーク可（ハイブリッド）", category: "workstyle" },
  { name: "確定拠出年金（401k相当）", category: "money" },
  { name: "RSU（譲渡制限付き株式）", category: "money" },
  { name: "書籍・学習費用補助", category: "learning" },
  { name: "ボランティア休暇（年7日）", category: "time_off" },
  { name: "育児・介護休暇制度", category: "family" },
  { name: "各種社会保険完備", category: "health" },
  { name: "ウェルネス費用補助", category: "health" },
  { name: "Ohana Groups（社内コミュニティ）", category: "workstyle" },
];

const SAMPLEWORKS: Benefit[] = [
  { name: "フレックスタイム制（コアタイム 11:00-15:00）", category: "workstyle" },
  { name: "リモートワーク可（週2出社）", category: "workstyle" },
  { name: "書籍購入補助（月1万円まで）", category: "learning" },
  { name: "カンファレンス参加費の全額補助", category: "learning" },
  { name: "確定拠出年金", category: "money" },
  { name: "ストックオプション", category: "money" },
  { name: "人間ドック補助（年1回）", category: "health" },
  { name: "副業可（届出制）", category: "workstyle" },
  { name: "リフレッシュ休暇（勤続3年ごとに5日）", category: "time_off" },
  { name: "在宅勤務手当（月5,000円）", category: "money" },
];

function d(p: Partial<CompanyDetail>): CompanyDetail {
  return p as CompanyDetail;
}

export default function CompanyBenefitsPreview() {
  devOnly();
  return (
    <div>
      <style>{PROFILE_CSS}</style>
      <PreviewHeader title="福利厚生（カテゴリごとの表）と働き方への引き継ぎ">
        企業ページと同じ部品に固定データを渡しています。カテゴリの無い項目は「その他」に入ります。
      </PreviewHeader>
      <Variant label="Salesforce（働き方の欄なし → 10件すべて福利厚生に出る・6カテゴリ）">
        <WorkstyleSection detail={d({ benefits: SALESFORCE })} />
        <BenefitTagsSection detail={d({ benefits: SALESFORCE })} />
      </Variant>
      <Variant label="サンプルワークス（働き方の欄あり → フレックスとリモートの補足を引き継ぐ。副業可と在宅勤務手当は福利厚生に残る）">
        <WorkstyleSection detail={d({ benefits: SAMPLEWORKS, workTimeSystem: "フレックスタイム制", remoteWorkStatus: "hybrid" })} />
        <BenefitTagsSection detail={d({ benefits: SAMPLEWORKS, workTimeSystem: "フレックスタイム制", remoteWorkStatus: "hybrid" })} />
      </Variant>
      <Variant label="カテゴリが無い既存の項目（すべて「その他」）">
        <BenefitTagsSection detail={d({ benefits: [{ name: "社員食堂" }, { name: "誕生日休暇" }] })} />
      </Variant>
      <Variant label="0件（セクションごと出ない）">
        <BenefitTagsSection detail={d({ benefits: null as unknown as Benefit[] })} />
      </Variant>
    </div>
  );
}
