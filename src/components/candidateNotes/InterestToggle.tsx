"use client";

import { useState } from "react";
import { CANDIDATE_STAGES, type CandidateStage } from "@/lib/constants/candidateNotes";

/**
 * ★候補者カードの「気になる」（2026-10-10 / 段5）。ow_candidate_tracking の stage=interested。
 * 状態が「気になる」以外（声かけ済み・面談 など）なら、その状態を表示するだけ（変えるのはプロフィールの社内メモから）。
 * ⚠️ 社内メモのフラグがオフなら呼び出し側が描かない。
 */
export function InterestToggle({ candidateUserId, initialStage }: { candidateUserId: string; initialStage: CandidateStage | null }) {
  const [stage, setStage] = useState(initialStage);
  const [busy, setBusy] = useState(false);
  if (stage && stage !== "interested") {
    return <span data-state="candidate-stage" style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{CANDIDATE_STAGES[stage]}</span>;
  }
  const on = stage === "interested";
  return (
    <button type="button" disabled={busy} aria-pressed={on} data-state={on ? "interested-on" : "interested-off"}
      onClick={async (e) => {
        e.preventDefault(); e.stopPropagation();
        setBusy(true);
        const next = on ? null : "interested";
        const res = await fetch(`/api/biz/candidates/${candidateUserId}/tracking`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: next }) });
        if (res.ok) setStage(next);
        setBusy(false);
      }}
      style={{ fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "5px 10px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
        border: `1px solid ${on ? "var(--royal)" : "var(--line)"}`, background: on ? "var(--royal-50)" : "#fff", color: on ? "var(--royal)" : "var(--ink-soft)" }}>
      {on ? "★ 気になる" : "☆ 気になる"}
    </button>
  );
}
