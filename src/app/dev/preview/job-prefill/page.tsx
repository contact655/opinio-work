import { devOnly } from "../guard";
import { sanitizeDraft } from "@/lib/jobs/prefill";
import { JobPrefillPreviewClient } from "./PreviewClient";

/**
 * 求人票の貼り付けから下書きを作る（段階3）のプレビュー。
 * ⚠️ DB も API も呼ばない。モデルの返答を固定データで作り、`sanitizeDraft`（本物）に通して並べる。
 * ⚠️ 確かめること: 選択肢に無い値・上下が逆の給与・業務委託でない雇用形態以外の語・「期間の定めなし」の期間などが落ちていること。
 */
export default function Page() {
  devOnly();
  const raw: Record<string, unknown> = {
    title: "インサイドセールス（IT・SaaS 領域の法人開拓）",
    descriptionMarkdown: "## 仕事内容\nIT・SaaS 企業向けに、当社サービスの新規開拓を担当していただきます。\n\n架電・メールでの初回接点づくりから、商談の設定までを担います。",
    employmentType: "正社員",
    salaryMin: 450, salaryMax: 700,
    location: "東京都港区赤坂（本社）",
    remoteWorkStatus: "hybrid",
    workHours: "9:30〜18:30（フレックスタイム制・コアタイム 11:00〜15:00）",
    holidays: "完全週休2日制（土日祝）、年末年始、夏季休暇",
    probationPeriod: "3か月（条件の変更なし）",
    requiredSkills: ["法人営業の経験 2年以上", "IT 業界での就業経験"],
    preferredSkills: ["インサイドセールスの経験", "Salesforce の利用経験"],
    selectionSteps: ["書類選考", "1次面接", "最終面接"],
    contractPeriod: "indefinite",
    contractPeriodDetail: "1年（←期間の定めなしなので落ちること）",
    workplaceChangeScope: "company",
    dutiesChangeScope: "company",
    breakTime: "60分",
    overtime: "yes",
    fixedOvertime: "yes", fixedOvertimeHours: 20, fixedOvertimePay: 50000,
    socialInsurance: ["health", "pension", "employment", "workers_comp", "unknown_value"],
    smokingMeasure: "indoor_ban",
  };
  const bad: Record<string, unknown> = {
    employmentType: "正社員（試用あり）", salaryMin: 800, salaryMax: 500, remoteWorkStatus: "リモート可",
    overtime: "たまに", socialInsurance: ["nope"], title: "   ",
  };
  const draft = sanitizeDraft(raw);
  const badDraft = sanitizeDraft(bad);
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 18 }}>求人票の貼り付け（下書き）</h1>
      <p style={{ fontSize: 13, color: "#64748b" }}>① 閉じた状態 ② 読み取ったあと（sanitizeDraft を通した結果）③ 不正な値だけの返答（何も残らないこと）</p>
      <h2 style={{ fontSize: 14, marginTop: 24 }}>① 入口</h2>
      <JobPrefillPreviewClient />
      <h2 style={{ fontSize: 14, marginTop: 24 }}>② 読み取ったあと</h2>
      <JobPrefillPreviewClient draft={draft} />
      <h2 style={{ fontSize: 14, marginTop: 24 }}>③ 不正な値だけ（{Object.keys(badDraft).length}項目残った）</h2>
      <pre data-state="bad-draft" style={{ fontSize: 12, background: "#f8fafc", padding: 8 }}>{JSON.stringify(badDraft)}</pre>
    </main>
  );
}
