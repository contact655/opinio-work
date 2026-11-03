import { PreviewHeader, Variant } from "../Variant";
import { devOnly } from "../guard";
import { JoinDecisionDemo } from "./Demo";
import { CompanyReasonRanking } from "@/app/(jobseeker)/companies/[id]/CompanyReasonRanking";
import { JOIN_DECISION_LABELS } from "@/lib/joinDecision/constants";

/**
 * 入社の決め手（1問・2026-11-02）と、企業ページの「この会社に決めた理由」。
 * ⚠️ 実データでは10人以上の回答がある会社が無いので、企業ページの表示はここで見る。DB には読みも書きもしない。
 */
export default function JoinDecisionPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="入社の決め手（この会社に決めた理由は？）">
        現職の会社を登録・更新したときと、ホームのカード（はじめて／スキップから30日後の1回だけ）から開くモーダル。
      </PreviewHeader>
      <JoinDecisionDemo />
      <div style={{ marginTop: 24 }}>
        <Variant label="企業ページ：上位3つあり（10人以上）" note="順位だけ。人数・割合・バーは出ない">
          <CompanyReasonRanking labels={["salary", "position", "people"].map((k) => JOIN_DECISION_LABELS[k])} />
        </Variant>
        <Variant label="企業ページ：10人未満" note="ページは何も描かない（見出しも注記も出ない）">
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>（このセクションは描かれない）</div>
        </Variant>
      </div>
    </div>
  );
}
