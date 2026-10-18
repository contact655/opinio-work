"use client";

import { useEffect, useRef } from "react";
import type { PublishRequirement } from "@/lib/jobs/publishRequirements";

/**
 * 求人の作成・編集画面の左の目次（2026-10-11 に作り直した）。
 *
 * ⚠️★**ステップの横の「あと N」は `missingForPublish()`（lib/jobs/publishRequirements.ts）の結果をステップごとに数えたもの。**
 *    ここで条件を足したり数え直したりしないこと。割れると「目次は0なのに申請できない」になる。
 * ⚠️ 旧版の「入力進捗 %」と「推奨項目」は外した。%は「何を書けば公開できるか」を言っていなかった。
 */

export type StepStatus = "done" | "todo" | "optional" | null;

export type EditStep = {
  id: string;
  label: string;
  status: StepStatus;
};

type Props = {
  steps: EditStep[];
  activeStep: string;
  onStepClick: (id: string) => void;
  missing: PublishRequirement[];
  onMissingClick: (r: PublishRequirement) => void;
  /** ★項目はそろっているが、すぐには公開されないときの一言（企業ページが非公開・運営確認になる）。無ければ「公開できます」 */
  readyNote?: string | null;
};

const STATUS_TEXT: Record<Exclude<StepStatus, null>, string> = { done: "済み", todo: "未入力", optional: "任意" };

export function JobEditSubNav({ steps, activeStep, onStepClick, missing, onMissingClick, readyNote = null }: Props) {
  /* 767px 以下では横並びなので、いまのステップが見える位置まで横に送る。
     ⚠️ scrollIntoView を使わない（ページ全体が縦にも動く） */
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const cur = nav?.querySelector<HTMLElement>("[aria-current]");
    if (nav && cur && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: Math.max(0, cur.offsetLeft - 16) });
  }, [activeStep]);

  return (
    <aside className="jef-subnav" style={{
      background: "var(--bg-tint)",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
    }}>
      {/* ★項目の並び（「公開まであと16項目」）は 2026-10-18 に外した（柴さんの指示。下の1〜6と同じことを2回言っていた）。
             足りないものは各ステップの横に「あと N」で出し、押すとそのステップの最初の未入力の欄へ移る。
             ⚠️ 数は missingForPublish() の結果をステップごとに数えるだけ（ここで条件を足さない） */}
      <div data-state={missing.length === 0 ? "ready" : "missing"} style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--line)" }}>
        {missing.length === 0 && (
          <div data-state="subnav-ready" style={{ fontSize: 13, fontWeight: 700, color: readyNote ? "var(--ink)" : "var(--success-ink)", marginBottom: 6 }}>{readyNote ?? "公開できます"}</div>
        )}
        <div className="jef-subnav-note" style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          入力した内容は自動で保存されます。公開後も運営が内容を確認し、問題がある場合は停止することがあります。
        </div>
      </div>

      {/* ⚠️ 767px 以下は横に並べて1行でスクロールさせる（縦に並べるとフォームが1画面下に落ちる） */}
      <style>{`
        .jef-subnav { border-right: 1px solid var(--line); }
        .jef-steps { display: flex; flex-direction: column; position: relative; }
        .jef-step { display: flex; align-items: center; gap: 8px; justify-content: space-between; width: 100%; padding: 10px 18px; border: none; border-left: 3px solid transparent; text-align: left; cursor: pointer; font-family: inherit; }
        .jef-step[aria-current] { border-left-color: var(--royal); }
        @media (max-width: 767px) {
          .jef-subnav { border-right: none; border-bottom: 1px solid var(--line); }
          .jef-steps { flex-direction: row; overflow-x: auto; }
          .jef-step { width: auto; flex-shrink: 0; white-space: nowrap; padding: 10px 14px; border-left: none; border-bottom: 3px solid transparent; }
          .jef-step[aria-current] { border-bottom-color: var(--royal); }
          .jef-subnav-note { display: none; }
        }
      `}</style>
      <nav ref={navRef} className="jef-steps" aria-label="求人の入力ステップ">
        {steps.map((s, i) => {
          const isActive = s.id === activeStep;
          const left = missing.filter((r) => r.step === s.id);
          return (
            <button
              key={s.id}
              type="button"
              /* 足りない項目があるステップは、その最初の欄へ移る */
              onClick={() => (left.length > 0 ? onMissingClick(left[0]) : onStepClick(s.id))}
              title={left.length > 0 ? `未入力：${left.map((r) => r.label).join("・")}` : undefined}
              aria-current={isActive ? "step" : undefined}
              data-state={s.status ?? "none"}
              className="jef-step"
              style={{
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--royal)" : "var(--ink-soft)",
                background: isActive ? "#fff" : "transparent",
              }}
            >
              <span style={{ minWidth: 0 }}>{i + 1}. {s.label}</span>
              {left.length > 0 ? (
                <span data-state="step-left" style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: "var(--warm-ink)" }}>あと{left.length}</span>
              ) : s.status && (
                <span style={{
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  color: s.status === "done" ? "var(--success-ink)" : s.status === "todo" ? "var(--warm-ink)" : "var(--ink-mute)",
                }}>
                  {STATUS_TEXT[s.status]}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
