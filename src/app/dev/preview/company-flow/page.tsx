import { PreviewHeader } from "../Variant";
import { devOnly } from "../guard";
import { CompanyFlowSection } from "@/app/(jobseeker)/companies/[id]/CompanyFlowSection";
import { toFlowSummary, type CompanyFlow } from "@/lib/companyFlow/compute";

/**
 * 企業ページ「人の流れ」（2026-10-27）。
 * ⚠️ 実データでは Salesforce の前職・在籍・行き先しか出ない（決め手・1年後・職種の変化は下限に届かない）ので、ここで全項目を見る。
 * ⚠️ DB を読まない（固定データを渡している）。
 */
const FULL: CompanyFlow = {
  people: 12,
  previous: { known: 9, byIndustry: [{ label: "メーカー", count: 4 }, { label: "金融", count: 3 }, { label: "IT・インターネット", count: 2 }] },
  next: { known: 5, byIndustry: [{ label: "IT・インターネット", count: 4 }, { label: "コンサルティング", count: 1 }] },
  tenure: { alumni: 5, avgMonths: 52 },
  roleChanges: { people: 3, paths: [{ label: "インサイドセールス → アカウントエグゼクティブ", count: 2 }, { label: "インサイドセールス → エンタープライズセールス", count: 1 }] },
  decisiveTop: { respondents: 6, top: [{ label: "身につくスキル", count: 4 }, { label: "年収・待遇", count: 3 }, { label: "一緒に働く仲間", count: 2 }] },
  fitAfterYear: { respondents: 5, goodShare: 80 },
};
const PARTIAL: CompanyFlow = { ...FULL, people: 4, previous: null, roleChanges: null, decisiveTop: null, fitAfterYear: null, next: null };

export default function CompanyFlowPreview() {
  devOnly();
  return (
    <div style={{ display: "grid", gap: 32 }}>
      <PreviewHeader title="人の流れ（企業ページの先頭）">ログインしている人／していない人、全項目／一部の項目。</PreviewHeader>
      <div><h2 style={{ fontSize: 14 }}>ログインしている人・全項目</h2><CompanyFlowSection companyId="p1" summary={toFlowSummary(FULL)} preview={{ authenticated: true, full: FULL }} /></div>
      <div><h2 style={{ fontSize: 14 }}>ログインしていない人（件数だけ）</h2><CompanyFlowSection companyId="p2" summary={toFlowSummary(FULL)} preview={{ authenticated: false, full: null }} /></div>
      <div><h2 style={{ fontSize: 14 }}>在籍だけ出せる会社</h2><CompanyFlowSection companyId="p3" summary={toFlowSummary(PARTIAL)} preview={{ authenticated: true, full: PARTIAL }} /></div>
    </div>
  );
}
