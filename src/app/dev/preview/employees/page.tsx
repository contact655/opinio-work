import { JobEmployeesSection } from "@/components/jobs/JobEmployeesSection";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { EMPLOYEES_1, EMPLOYEES_3, EMPLOYEES_12, ALUMNI_3, ALUMNI_12 } from "../fixtures";

/**
 * 現役社員 / OB・OG のプレビュー（2026-08-30）。
 *
 * ⚠️★**この画面を作った直接の理由。** 2026-08-30 に求人詳細の OB・OG を
 *    「この職種を経験して退職した人」に絞ったが、公開求人2件とも該当0名で
 *    **カードが出る側を一度も描画できないまま出した。**
 *
 * ⚠️ `casualHref` を渡すと**カードごとに指名付きCTA**が出る。
 *    `talkableIds` に居る人だけが対象（面談可の同意＋掲載）。
 * ⚠️ OB・OG には**指名CTAを出さない**（退職者に「話を聞く」導線は出さない）。
 */
const CASUAL = "/companies/preview-company/casual-meeting";
const COMPANY_ID = "preview-company";

export default function EmployeesPreview() {
  devOnly();
  /* ⚠️ 全員を面談可にはしない。**一部だけ**にして、CTA が出る人と出ない人が
        混ざったときの見え方を確かめる（実データでもそうなる）。 */
  const talkableSome = new Set(EMPLOYEES_3.slice(0, 2).map((e) => e.userId));
  const talkableAll = new Set(EMPLOYEES_12.map((e) => e.userId));

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
          casualHref={CASUAL} talkableIds={new Set(EMPLOYEES_1.map((e) => e.userId))}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="OB・OG 3件" note="⚠️ ここが実データで一度も見られていない側。3件目は氏名・役職が極端に長い">
        <JobEmployeesSection
          current={[]} alumni={ALUMNI_3} companyId={COMPANY_ID}
          casualHref={CASUAL} talkableIds={new Set()}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="OB・OG 12件" note="⚠️ 2列グリッドが縦に伸びるだけか。件数バッジが出るか">
        <JobEmployeesSection
          current={[]} alumni={ALUMNI_12} companyId={COMPANY_ID}
          casualHref={CASUAL} talkableIds={new Set()}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="現役 3件（うち2名が面談可）" note="⚠️ CTA が出る人と出ない人が混ざる。カードの高さが揃うか">
        <JobEmployeesSection
          current={EMPLOYEES_3} alumni={[]} companyId={COMPANY_ID}
          casualHref={CASUAL} talkableIds={talkableSome}
          alwaysShowAlumni
        />
      </Variant>

      <Variant label="現役 12件（全員 面談可）" note="⚠️ CTA が12個並ぶ。オレンジが多すぎないか">
        <JobEmployeesSection
          current={EMPLOYEES_12} alumni={[]} companyId={COMPANY_ID}
          casualHref={CASUAL} talkableIds={talkableAll}
        />
      </Variant>

      <Variant label="企業が面談受付を止めている" note="⚠️ casualHref が null。CTA が1つも出ないこと（飛べない導線を置かない）">
        <JobEmployeesSection
          current={EMPLOYEES_3} alumni={ALUMNI_3} companyId={COMPANY_ID}
          casualHref={null} talkableIds={talkableSome}
        />
      </Variant>

      <Variant label="現役・OB とも0件（alwaysShowAlumni なし）" note="⚠️ 何も描画されないこと（会社セクション側の挙動）">
        <JobEmployeesSection
          current={[]} alumni={[]} companyId={COMPANY_ID}
          casualHref={CASUAL} talkableIds={new Set()}
        />
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（何も描画されない ← これが正しい）</p>
      </Variant>
    </div>
  );
}
