import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { PreviewHeaderLines, TouchpointSection, TouchpointGuide } from "@/app/biz/candidates/CandidatePreview";
import type { Candidate, Touchpoint, TouchpointMaterials } from "@/lib/business/candidates/model";

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

/* ★2026-10-12 の並び（仕事 → 業界 → 人 → 条件 → 事業ステージ）と具体的な文 */
const ordered: Touchpoint[] = [
  { kind: "job_role", weight: 9, ref: null, text: "フィールドセールスを5年経験（求人『法人営業（SaaS）』の求める経験：3年以上）",
    fact: { kind: "job_role", jobId: "j", jobTitle: "法人営業（SaaS）", months: 62, requiredYears: 3, roleName: "フィールドセールス" } },
  tp("position_level", "課長・マネージャークラスの経験があります（求人『法人営業（SaaS）』のレベル：課長・マネージャークラス）", 7),
  tp("company_role", "関心のある職種『フィールドセールス』が、営業部の職種『フィールドセールス』と一致", 6),
  tp("target_industry", "貴社の顧客の業界（製造業）での経験があります", 5),
  tp("alumni", "株式会社サンプルテックの出身者が、貴社に2名在籍しています", 3),
  tp("location", "求人の勤務地（東京都）とお住まいが合っています", 2),
  tp("business_stage", "同じ事業ステージ（シリーズB）の会社（株式会社サンプルテック）での経験があります", 1),
];
const mat = (m: Partial<TouchpointMaterials>): TouchpointMaterials => ({ hasJobs: false, hasCompanyRoles: true, hasPublicEmployees: false, ...m });

/* 右欄の上の段（3・4行目）に要る項目だけ。⚠️ 部品は本番と同じ */
const person = (careerStance: string | null, touchpoints: Touchpoint[] | undefined) => ({ careerStance, touchpoints }) as unknown as Candidate;

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="〈会社名〉と合うところ（/biz/candidates の右のプレビュー）">
        <p>2026-10-11 に「貴社との接点」から改めた。右欄のプロフィールの先頭に開閉なしで出す（2026-10-12）。強い順に2つまで全文。3つ以上は「ほか N件」で、押すとその場で全部。（〇）は項目の数。0件・取得失敗は見出しごと出さない。</p>
      </PreviewHeader>
      <Variant label="0件" note="見出しごと出ない（何も描かれないのが正しい）">
        <TouchpointSection touchpoints={[]} companyShortName="Third Box" />
      </Variant>
      <Variant label="2件" note="「Third Boxと合うところ（2）」。「ほか」は出ない">
        <TouchpointSection touchpoints={two} companyShortName="Third Box" />
      </Variant>
      <Variant label="5件" note="（5）・2件と「ほか3件」。押すとその場で全部">
        <TouchpointSection touchpoints={five} companyShortName="Third Box" />
      </Variant>
      <Variant label="会社名が取れない" note="「貴社と合うところ（2）」">
        <TouchpointSection touchpoints={two} companyShortName={null} />
      </Variant>
      <Variant label="取得に失敗（undefined）" note="欄ごと出さない（0件と言わない）">
        <TouchpointSection touchpoints={undefined} companyShortName="Third Box" />
      </Variant>
      <Variant label="7件・並び順（2026-10-12）" note="仕事（経験年数・レベル・職種）→ 業界 → 人 → 条件 → 事業ステージ。経験年数を満たすものは分類が「経験年数」">
        <TouchpointSection touchpoints={ordered} companyShortName="Third Box" />
      </Variant>
      <h2 style={{ fontSize: 16, margin: "32px 0 8px" }}>0件のときの案内（2026-10-12）</h2>
      <Variant label="標準の職種が未選択の職種がある" note="灰色の1行・部門・職種へ">
        <TouchpointGuide touchpoints={[]} materials={mat({ hasUnlinkedCompanyRoles: true, hasJobs: true, hasJobsWithoutYears: true })} />
      </Variant>
      <Variant label="求人に経験年数が無い" note="灰色の1行・求人管理へ">
        <TouchpointGuide touchpoints={[]} materials={mat({ hasJobs: true, hasJobsWithoutYears: true })} />
      </Variant>
      <Variant label="足すものが無い" note="何も出ない（何も描かれないのが正しい）">
        <TouchpointGuide touchpoints={[]} materials={mat({})} />
      </Variant>
      <Variant label="合うところがある" note="出ない">
        <TouchpointGuide touchpoints={two} materials={mat({ hasUnlinkedCompanyRoles: true })} />
      </Variant>
      <h2 style={{ fontSize: 16, margin: "32px 0 8px" }}>右欄の上の段（3・4行目。2026-10-12）</h2>
      <Variant label="意向・接点（ほか2件）" note="灰色の文字だけ。合うところはここに出さない（プロフィールの先頭に出る）">
        <PreviewHeaderLines candidate={person("active", five)}
          contacts={{ latest: { at: "2025-03-14T02:00:00Z", title: "応募：インサイドセールス" }, more: 2 }} />
      </Variant>
      <Variant label="接点だけ（ほか0件）" note="意向が無ければ3行目は出ない">
        <PreviewHeaderLines candidate={person(null, [])}
          contacts={{ latest: { at: "2026-09-02T02:00:00Z", title: "カジュアル面談の申込：ポジション指定なし" }, more: 0 }} />
      </Variant>
      <Variant label="何も無い" note="3・4行目とも出ない（何も描かれないのが正しい）">
        <PreviewHeaderLines candidate={person(null, [])} contacts={null} />
      </Variant>
    </div>
  );
}
