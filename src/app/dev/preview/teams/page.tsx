import OrgTeamsSectionClient from "@/app/(jobseeker)/companies/[id]/OrgTeamsSectionClient";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import {
  detailWith, TEAMS_1, TEAMS_ONE_DIVISION, TEAMS_5_DIVISIONS,
  TEAMS_NO_DIVISION, TEAMS_EDGE, TEAMS_23,
} from "../fixtures";

/**
 * 組織体制のプレビュー（2026-08-30）。
 *
 * ⚠️ 実データは **Salesforce 1社（23チーム / 8部門）だけ**。
 *    0件・1件・部門が1つ・`division` 未設定 を実データでは踏めない。
 *
 * ⚠️★**実ページと同じ呼び方をすること。** 企業ページは
 *    `<OrgTeamsSectionClient detail={detail} companyId={company.id} jobCount={company.job_count} />`。
 *    `jobCount` を変えると導線の出方が変わるので、0 と 1以上 の両方を見る。
 */
const COMPANY_ID = "preview-company";

export default function TeamsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="組織体制・チーム">
        企業詳細の <code>OrgTeamsSectionClient</code> です。
        チームを <strong>部門（division）</strong>で束ねて表示します。
      </PreviewHeader>

      <Variant label="0件（null）" note="⚠️ セクションごと出ないこと">
        <OrgTeamsSectionClient detail={detailWith({ orgTeams: null })} companyId={COMPANY_ID} jobCount={0} />
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（何も描画されない ← これが正しい）</p>
      </Variant>

      <Variant label="1チーム" note="⚠️ 束ねる意味が無いとき。見出しが冗長にならないか">
        <OrgTeamsSectionClient detail={detailWith({ orgTeams: TEAMS_1 })} companyId={COMPANY_ID} jobCount={0} />
      </Variant>

      <Variant label="3チーム・1部門" note="部門が1つだけ。部門見出しが要るか">
        <OrgTeamsSectionClient detail={detailWith({ orgTeams: TEAMS_ONE_DIVISION })} companyId={COMPANY_ID} jobCount={0} />
      </Variant>

      <Variant label="8チーム・5部門" note="⚠️ 束ね方と「すべて見る」の境界">
        <OrgTeamsSectionClient detail={detailWith({ orgTeams: TEAMS_5_DIVISIONS })} companyId={COMPANY_ID} jobCount={0} />
      </Variant>

      <Variant
        label="division 未設定が混ざる"
        note="⚠️★部門の無いチームがどこへ入るか。消えないこと（1件も欠けさせない）"
      >
        <OrgTeamsSectionClient detail={detailWith({ orgTeams: TEAMS_NO_DIVISION })} companyId={COMPANY_ID} jobCount={0} />
      </Variant>

      <Variant label="長い名前 / roles 空 / roles 5つ" note="⚠️ 折り返しと、roles が空のときに行ごと消えるか">
        <OrgTeamsSectionClient detail={detailWith({ orgTeams: TEAMS_EDGE })} companyId={COMPANY_ID} jobCount={0} />
      </Variant>

      <Variant label="23チーム・8部門（Salesforce と同規模）・求人あり" note="⚠️ jobCount を 5 にして、求人への導線が出るかも見る">
        <OrgTeamsSectionClient detail={detailWith({ orgTeams: TEAMS_23 })} companyId={COMPANY_ID} jobCount={5} />
      </Variant>
    </div>
  );
}
