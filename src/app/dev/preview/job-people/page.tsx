import type { CompanyEmployee } from "@/lib/supabase/queries";
import { JobPeopleCards, JOB_PEOPLE_CSS } from "@/components/jobs/JobPeopleCards";
import { JobEmployeesSection } from "@/components/jobs/JobEmployeesSection";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { EMPLOYEES_1, EMPLOYEES_3, EMPLOYEES_12, ALUMNI_3 } from "../fixtures";

/**
 * ★求人詳細の「人」を縦長のカードにする見本（2026-10-20）。
 *   部品は components/jobs/JobPeopleCards。★2026-10-20 に求人詳細へ入れた。
 * ⚠️ この配下で DB を読まない（固定データだけ）。
 */

/** 見本用の枠（求人詳細のセクションと同じ見出しの形）。⚠️ 本物に入れるときは JobEmployeesSection の中で使う */
function Frame({ title, count, sub, children }: { title: string; count: number; sub?: string; children: React.ReactNode }) {
  return (
    <section className="person-section-body" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: sub ? 4 : "var(--space-4)" }}>
        <span style={{ fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{count}名</span>
      </div>
      {sub && <p style={{ margin: "0 0 var(--space-3)", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>{sub}</p>}
      {children}
    </section>
  );
}

const EMPLOYEES_2 = EMPLOYEES_12.slice(0, 2);
const EMPLOYEES_5 = EMPLOYEES_12.slice(0, 5);

export default function JobPeoplePreview() {
  devOnly();
  const people = (title: string, list: CompanyEmployee[], sub?: string) => (
    <Frame title={title} count={list.length} sub={sub}><JobPeopleCards people={list} /></Frame>
  );
  return (
    <div>
      <style>{JOB_PEOPLE_CSS}</style>
      <PreviewHeader title="求人詳細の人（縦長のカード）">
        求人詳細の「この職種の現役メンバー」「この職種のOB・OG」「この会社の他の現役社員」を、行からカードにした見本です。
        3人以上は横にスクロール、1〜2人は左寄せで並べます。ブラウザの幅を 390px にして見てください。
      </PreviewHeader>

      <Variant label="1人" note="横に流さない。いまの公開求人はこの形">
        {people("この職種の現役メンバー", EMPLOYEES_1)}
      </Variant>

      <Variant label="2人" note="横に流さない">
        {people("この職種のOB・OG", EMPLOYEES_2)}
      </Variant>

      <Variant label="3人（名前・肩書きが長い人を含む）" note="ここから横スクロール。名前は1行、肩書きは2行で切る（押すと全文はプロフィールで読める）">
        {people("この職種のOB・OG", ALUMNI_3)}
      </Variant>

      <Variant label="5人（いまの「この会社の他の現役社員」と同じ人数）" note="行の形だと約650px。カードだと1段">
        {people("この会社の他の現役社員", EMPLOYEES_5, "この募集の職種とは違う人たちです")}
      </Variant>

      <Variant label="12人" note="横に送って全員見られる">
        {people("この会社の他の現役社員", EMPLOYEES_12, "この募集の職種とは違う人たちです")}
      </Variant>

      <Variant label="本物の部品（JobEmployeesSection）で5人" note="求人詳細で実際に使う形（見出し・人数・説明の1行つき）">
        <JobEmployeesSection current={EMPLOYEES_5} alumni={[]} companyId="preview-company"
          currentTitle="この会社の他の現役社員" currentSubtitle="この募集の職種とは違う人たちです" />
      </Variant>

      <Variant label="本物の部品で OB・OG 0人" note="「まだ登録されていません」はそのまま">
        <JobEmployeesSection current={EMPLOYEES_3} alumni={[]} companyId="preview-company" alwaysShowAlumni />
      </Variant>
    </div>
  );
}
