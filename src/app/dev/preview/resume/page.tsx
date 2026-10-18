import { ResumeDocument, RESUME_CSS, type ResumeDocData } from "@/components/profile/ResumeDocument";
import { buildResumeCompanies, type ResumeExperienceInput } from "@/lib/profile/resume";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 職務経歴書（/mypage/resume）のプレビュー（2026-10-18）。
 * ⚠️ 実データは職歴0件の人が多く、中身が詰まった側はここでしか見られない。DB を読まない。
 */
const exp = (o: Partial<ResumeExperienceInput> & { id: string }): ResumeExperienceInput => ({
  companyName: null, companyKey: null, role: null, department: null, rank: null, employmentType: null,
  startedAt: null, endedAt: null, isCurrent: false, description: null, secondmentCompanyName: null, ...o,
});

const FULL_EXPS: ResumeExperienceInput[] = [
  exp({ id: "e1", companyName: "株式会社Opinio", companyKey: "c1", role: "代表取締役", startedAt: "2023-04", isCurrent: true,
    description: "IT/SaaS 業界に特化したキャリアプラットフォームを企画・開発。\n採用企業 20社の掲載を立ち上げ、プロダクトと営業の両方を担当。" }),
  exp({ id: "e2", companyName: "株式会社セールスフォース・ジャパン", companyKey: "c2", department: "エンタープライズ営業本部", role: "アカウントエグゼクティブ", rank: "シニア", startedAt: "2019-07", endedAt: "2023-03", employmentType: "正社員",
    description: "大手製造業 12社を担当し、CRM の新規導入と拡大を推進。" }),
  exp({ id: "e3", companyName: "株式会社セールスフォース・ジャパン", companyKey: "c2", role: "インサイドセールス", startedAt: "2017-04", endedAt: "2019-06", employmentType: "正社員" }),
  exp({ id: "e4", companyName: "株式会社リクルート", companyKey: "c3", role: "法人営業", startedAt: "2013-04", endedAt: "2017-03",
    secondmentCompanyName: "株式会社リクルートキャリア" }),
];
const FULL: ResumeDocData = {
  asOf: "2026年10月18日現在",
  name: "山田 太郎",
  about: "法人営業として10年。新規開拓からエンタープライズの拡大まで、SaaS の営業を一通り経験しています。",
  totalLabel: "13年",
  companies: buildResumeCompanies(FULL_EXPS, [
    { experienceId: "e2", title: "年間売上目標達成率", value: "142", unit: "%", description: "2021年度・全国2位" },
    { experienceId: "e2", title: "新規受注", value: "8", unit: "社", description: null },
  ]),
  autoSkills: [{ label: "法人営業", band: "5年以上" }, { label: "インサイドセールス", band: "1〜3年" }],
  skillLabels: ["Salesforce", "SQL", "プレゼンテーション"],
  achievements: ["社内ハッカソン優勝（2022年）"],
  certifications: [{ name: "TOEIC 860点", issuer: null, issuedAt: "2018-05" }, { name: "Salesforce 認定アドミニストレーター", issuer: "Salesforce", issuedAt: null }],
  languages: [{ label: "英語", level: "ビジネス会話" }],
  awards: [{ title: "Rookie of the Year", issuer: "株式会社リクルート", awardedAt: "2014-03" }],
  educations: [{ school: "獨協大学", faculty: "経済学部経済学科", degree: "学士", enrolledAt: "2009-04", graduatedAt: "2013-03", isCurrent: false }],
};
const EMPTY: ResumeDocData = {
  asOf: "2026年10月18日現在", name: "山田 太郎", about: "", totalLabel: null, companies: [],
  autoSkills: [], skillLabels: [], achievements: [], certifications: [], languages: [], awards: [], educations: [],
};
const LONG_EXPS: ResumeExperienceInput[] = [
  exp({ id: "l1", companyName: "グローバル・エンタープライズ・ソリューションズ・アンド・コンサルティング・ジャパン合同会社", companyKey: "x",
    department: "デジタルトランスフォーメーション推進統括本部 第二エンタープライズ営業部", role: "シニアカスタマーサクセスマネージャー", startedAt: "2020-01", isCurrent: true,
    description: "https://example.com/very/long/url/without/any/break/points/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
  exp({ id: "l2", companyName: null, companyKey: null, role: "営業", startedAt: null, endedAt: null }),
];

export default function ResumePreview() {
  devOnly();
  return (
    <div>
      <style>{RESUME_CSS}</style>
      <PreviewHeader title="職務経歴書">
        <code>/mypage/resume</code> の本体（<code>ResumeDocument</code>）です。同じ会社で続いた役割は1社の下にまとまり、
        新しい順に並びます。値の無い項目は出ません。
      </PreviewHeader>
      <Variant label="すべて入っている" note="同じ会社の2役割が1社にまとまる・出向・実績・資格・語学・受賞・学歴">
        <ResumeDocument d={FULL} />
      </Variant>
      <Variant label="空（職歴0件・自己紹介なし）" note="⚠️ 案内文は印刷に出ない（data-print-hide）">
        <ResumeDocument d={EMPTY} />
      </Variant>
      <Variant label="長い社名・部署・切れ目のない URL・期間なし・社名なし" note="⚠️ 375px ではみ出さないこと">
        <ResumeDocument d={{ ...EMPTY, companies: buildResumeCompanies(LONG_EXPS, []) }} />
      </Variant>
    </div>
  );
}
