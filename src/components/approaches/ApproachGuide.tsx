"use client";

import { Fragment, useState } from "react";
import { ChevronRight, MessageSquare, Send, Clock } from "lucide-react";
import { APPROACH_EXPIRE_DAYS, APPROACH_MONTHLY_LIMIT } from "@/lib/constants/companyApproaches";

/**
 * ★声かけの仕組み（3ステップ）と、受け入れられやすい理由の書き方（2026-10-11 / 柴さんの指示。LinkedIn Recruiter の InMail 画面を参考）。
 *   /biz/approaches と /biz/help/approaches が同じ部品を使う。**文言を2か所に書かないこと。**
 * ⚠️ 企業側の言葉は「返事待ち」「受け入れられた」。「承認」と書かない（docs/approach-wording-20261011.md）。
 */
export const APPROACH_STEPS = [
  { Icon: Send, title: "理由を添えて送る", note: `経歴を見て、声をかけたい理由を書きます。毎月${APPROACH_MONTHLY_LIMIT}通まで` },
  { Icon: Clock, title: `相手が確認する（返事は${APPROACH_EXPIRE_DAYS}日まで）`, note: "見送られたかどうかは、企業には表示されません" },
  { Icon: MessageSquare, title: "受け入れられたら、メッセージが開く", note: "メッセージで、日程や話したいことを相談できます" },
] as const;

export const APPROACH_TIPS = [
  "経歴のどこに惹かれたかを具体的に書く",
  "自社で何をお願いしたいかを1文で書く",
  "選考ではなく、まず話を聞きたいと伝える",
] as const;

/** 大きい形（横並びの3つの箱と矢印）。⚠️ 狭い画面（767px 以下）では縦に積み、矢印を下向きにする */
export function ApproachStepsLarge() {
  return (
    <div className="apg-steps" data-state="approach-steps-large">
      <style>{`
        .apg-steps { display: flex; align-items: stretch; gap: 8px; min-width: 0; }
        .apg-step { flex: 1 1 0; min-width: 0; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
        .apg-arrow { flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--ink-mute); }
        @media (max-width: 767px) {
          .apg-steps { flex-direction: column; }
          .apg-arrow { transform: rotate(90deg); }
        }
      `}</style>
      {APPROACH_STEPS.map((s, i) => (
        <Fragment key={s.title}>
          {i > 0 && <div className="apg-arrow" aria-hidden="true"><ChevronRight size={20} /></div>}
          <div className="apg-step">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "var(--royal-50)", color: "var(--royal)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <s.Icon size={18} strokeWidth={2.2} />
              </span>
              <div style={{ minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--royal)", marginRight: 4 }}>{i + 1}.</span>{s.title}
              </div>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-soft)" }}>{s.note}</p>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** 小さい形（1行）。「仕組みを見る」で大きい形を開く。⚠️ 1件以上送ったあとに使う */
export function ApproachStepsCompact() {
  const [open, setOpen] = useState(false);
  return (
    <div data-state="approach-steps-compact" style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-soft)" }}>
        <span style={{ minWidth: 0 }}>
          {APPROACH_STEPS.map((s, i) => `${["①", "②", "③"][i]} ${s.title}`).join(" → ")}
        </span>
        <button type="button" className="btn-fixed-size" aria-expanded={open} aria-controls="approach-steps-detail" onClick={() => setOpen((v) => !v)}
          style={{ background: "none", border: "none", padding: 0, minHeight: 32, font: "inherit", fontSize: 12.5, fontWeight: 700, color: "var(--royal)", cursor: "pointer" }}>
          {open ? "仕組みを閉じる" : "仕組みを見る"}
        </button>
      </div>
      {open && <div id="approach-steps-detail" style={{ marginTop: 10 }}><ApproachStepsLarge /></div>}
    </div>
  );
}

export function ApproachTipsList() {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc", fontSize: 13, lineHeight: 1.9, color: "var(--ink)" }}>
      {APPROACH_TIPS.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}
