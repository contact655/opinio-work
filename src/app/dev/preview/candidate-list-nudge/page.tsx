import { PreviewHeader, Variant } from "../Variant";
import { devOnly } from "../guard";
import CandidateListNudge from "@/components/mypage/CandidateListNudge";
import { buildCandidateListNudge, type CandidateListFieldInput } from "@/lib/profile/candidateListFields";

/**
 * 「企業の候補者一覧に表示される項目」の案内（2026-11-27）。/mypage の上部に出す。
 * ⚠️ DB には読みも書きもしない。判定は本物の関数（buildCandidateListNudge）に固定の値を渡す。
 * ⚠️ 閉じると30日出なくなる（この見本でも同じ localStorage を使う）。見直すときは localStorage の
 *    opinio:candidate-list-nudge:dismissed-at を消す。
 */
const NOW = new Date("2026-11-27T00:00:00Z");
const FULL: CandidateListFieldInput = {
  hasAvatar: true, hasCurrentExperience: true, hasCurrentRoleAndCompany: true,
  careerStance: "active", careerStanceUpdatedAt: "2026-11-20T00:00:00Z", location: "東京都", desiredRoleCount: 1,
};

export default function CandidateListNudgePreview() {
  devOnly();
  const two = buildCandidateListNudge({ ...FULL, hasAvatar: false, location: null }, NOW);
  const all = buildCandidateListNudge({
    ...FULL, hasAvatar: false, hasCurrentExperience: false, hasCurrentRoleAndCompany: false,
    location: null, desiredRoleCount: 0, careerStanceUpdatedAt: "2026-07-01T00:00:00Z",
  }, NOW);
  const noContact = buildCandidateListNudge({ ...FULL, hasAvatar: false, location: null, careerStance: "no_contact" }, NOW);
  return (
    <div>
      <PreviewHeader title="企業の候補者一覧に表示される項目（/mypage の案内）">
        意向が「積極的」「いい話なら聞きたい」「情報収集中」で、空いている項目がある人にだけ出す。閉じたら30日出さない。
      </PreviewHeader>
      <Variant label="積極的・写真と居住地が空" note="2項目だけ並ぶこと。意向は7日前に更新（更新の1行は出ない）">
        <CandidateListNudge nudge={two} />
      </Variant>
      <Variant label="現職なし・写真・居住地・希望職種が空、意向の更新が90日より前" note="4項目と、更新を勧める1行">
        <CandidateListNudge nudge={all} />
      </Variant>
      <Variant label="今は考えていない（写真と居住地が空）" note="何も出ないこと">
        <div data-state="no-contact-result">{noContact === null ? "（案内なし）" : "★出てしまっている"}</div>
        <CandidateListNudge nudge={noContact} />
      </Variant>
    </div>
  );
}
