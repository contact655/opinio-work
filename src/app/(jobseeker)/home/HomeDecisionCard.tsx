"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JoinDecisionModal } from "@/components/profile/editor/JoinDecisionModal";
import { JOIN_DECISION_PRIVACY_NOTE, JOIN_DECISION_QUESTION, homeDecisionCardVisible } from "@/lib/joinDecision/constants";

/**
 * ★ホームの「入社の決め手」（2026-11-02）。転機の3問のカード（HomeTurnCard）を置き換えた。
 *   現職の会社について、まだ聞いていない（オンボーディングで登録した人など）か、
 *   スキップから30日たった1回だけ出す（判定はサーバー。lib/joinDecision/server.ts の currentJoinDecisionPrompt）。
 * ⚠️ 再表示（reshow）は、モーダルを開いた時点で記録する（JoinDecisionModal）。
 * ⚠️★再表示のカードは、開かずにページを離れても次は出ない……ではない。開くまでは出続ける（記録はモーダルを開いたときだけ）。
 * ★答えて保存したら、モーダルを閉じた時点でカードを消す（homeDecisionCardVisible。2026-11-03）。再読み込みを待たない。
 */
export default function HomeDecisionCard({ experienceId, companyName }: { experienceId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [answered, setAnswered] = useState(false);
  const router = useRouter();
  if (!homeDecisionCardVisible({ answered, modalOpen: open })) return null;
  return (
    <section data-state="home-decision" className="home-box">
      <h2 className="home-h2">{companyName}について：{JOIN_DECISION_QUESTION}</h2>
      <p className="home-lead">3つまで選べます。{JOIN_DECISION_PRIVACY_NOTE}。</p>
      <button type="button" onClick={() => setOpen(true)} data-action="home-decision-open"
        style={{ marginTop: 12, padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
        答える
      </button>
      {open && (
        <JoinDecisionModal
          open
          experienceId={experienceId}
          companyName={companyName}
          onSaved={() => setAnswered(true)}
          onClose={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </section>
  );
}
