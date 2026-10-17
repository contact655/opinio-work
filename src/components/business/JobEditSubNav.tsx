"use client";

import { useEffect, useRef } from "react";
import type { PublishRequirement } from "@/lib/jobs/publishRequirements";

/**
 * 求人の作成・編集画面の左の目次（2026-10-11 に作り直した）。
 *
 * ⚠️★**「公開まであと〇つ」は `missingForPublish()`（lib/jobs/publishRequirements.ts）の結果をそのまま出す。**
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
      {/* ★公開まであと〇つ。押すとその入力欄へ移る */}
      <div data-state={missing.length === 0 ? "ready" : "missing"} style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--line)" }}>
        {missing.length === 0 ? (
          <div data-state="subnav-ready" style={{ fontSize: 13, fontWeight: 700, color: readyNote ? "var(--ink)" : "var(--success-ink)" }}>{readyNote ?? "公開できます"}</div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              公開まであと{missing.length}{missing.length < 10 ? "つ" : "項目"}
            </div>
            {/* ★スマホ（767px 以下）は横に1行でスクロール（2026-10-18）。16項目が6行に折り返し、最初の画面が埋まっていた。
                   ⚠️ 折り返しは CSS（.jesn-missing）。インラインに戻さないこと */}
            <style>{`
              .jesn-missing { display: flex; flex-wrap: wrap; gap: 6px; }
              @media (max-width: 767px) {
                .jesn-missing { flex-wrap: nowrap; overflow-x: auto; margin: 0 -18px; padding: 0 18px 2px; scrollbar-width: none; }
                .jesn-missing::-webkit-scrollbar { display: none; }
                .jesn-missing button { flex-shrink: 0; white-space: nowrap; }
              }
            `}</style>
            <div className="jesn-missing">
              {missing.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onMissingClick(r)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
                    border: "1px solid var(--line)", background: "#fff", color: "var(--royal)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="jef-subnav-note" style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6, marginTop: 10 }}>
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
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStepClick(s.id)}
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
              {s.status && (
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
