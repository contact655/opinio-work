import { JobEmployeesSection } from "@/components/jobs/JobEmployeesSection";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { EMPLOYEES_1, EMPLOYEES_3, EMPLOYEES_12, ALUMNI_3, ALUMNI_12,
  EMPLOYEES_COLOR_NOW } from "../fixtures";

/**
 * 現役社員 / OB・OG のプレビュー（2026-08-30）。
 *
 * ⚠️★**この画面を作った直接の理由。** 2026-08-30 に求人詳細の OB・OG を
 *    「この職種を経験して退職した人」に絞ったが、公開求人2件とも該当0名で
 *    **カードが出る側を一度も描画できないまま出した。**
 *
 * ⚠️ カードごとの「◯◯さんに話を聞く →」（指名付きCTA）は 2026-10-16 に撤去した。
 */
const COMPANY_ID = "preview-company";

export default function EmployeesPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="現役社員 / OB・OG">
        求人詳細の <code>JobEmployeesSection</code> です。
        現役は<strong>0件だと枠ごと消え</strong>、OB・OG は
        <strong>0件でも枠を出します</strong>（<code>alwaysShowAlumni</code>）。
      </PreviewHeader>

      <Variant label="OB・OG 0件（空状態）" note="⚠️ 求人詳細の既定。「まだ登録されていません」が出る">
        <JobEmployeesSection
          current={EMPLOYEES_1} alumni={[]} companyId={COMPANY_ID}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="OB・OG 3件" note="⚠️ ここが実データで一度も見られていない側。3件目は氏名・役職が極端に長い">
        <JobEmployeesSection
          current={[]} alumni={ALUMNI_3} companyId={COMPANY_ID}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="OB・OG 12件" note="⚠️ 2列グリッドが縦に伸びるだけか。件数バッジが出るか">
        <JobEmployeesSection
          current={[]} alumni={ALUMNI_12} companyId={COMPANY_ID}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="現役 3件" note="⚠️ カードの高さが揃うか">
        <JobEmployeesSection
          current={EMPLOYEES_3} alumni={[]} companyId={COMPANY_ID}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="現役 12件" note="⚠️ 2列グリッドが縦に伸びるだけか">
        <JobEmployeesSection
          current={EMPLOYEES_12} alumni={[]} companyId={COMPANY_ID}
        />
      </Variant>

      {/* ✅ 職種別カラーは 2026-09-02 に「持たない」で決着（柴さんの判断）。
             A案 / B案 の並置は削除した。表が無くなった以上、B案を描いても
             A案と同じ見た目にしかならず、判断材料にならないため。 */}
      <Variant
        label="アバターの色（全員おなじ）"
        note="✅ 職種で色を変えない（`lib/avatarColor.ts` の AVATAR_COLOR に固定）。凡例の無い色分けは持たない、という判断。ここに色表を作り直さないこと。"
      >
        <JobEmployeesSection
          current={EMPLOYEES_COLOR_NOW} alumni={[]} companyId={COMPANY_ID}
          currentTitle="6人とも別の職種（色は同じになるのが正しい）"
        />
      </Variant>


      <Variant label="現役・OB とも0件（alwaysShowAlumni なし）" note="⚠️ 何も描画されないこと（会社セクション側の挙動）">
        <JobEmployeesSection
          current={[]} alumni={[]} companyId={COMPANY_ID}
        />
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（何も描画されない ← これが正しい）</p>
      </Variant>
    </div>
  );
}
