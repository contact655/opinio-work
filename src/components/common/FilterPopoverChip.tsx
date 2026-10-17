"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import { FILTER_OPTION_CSS } from "./FilterDrawer";

/**
 * ★一次チップのドロップダウン（2026-10-13 / 候補者を探す ステップ5の修正）。
 *   中身は呼び出し側が渡す。「すべてのフィルター」のドロワーと**同じ軸の部品**（例: biz/candidates/filterAxes.tsx）を入れて、
 *   件数・0件の灰色・畳み方をドロワーと揃えるための器。
 *
 * ⚠️★見た目（チップのボタン）は `FilterChip` に合わせてある（同じ行に並ぶため）。チップの色・余白を片方だけ変えないこと。
 * ⚠️ 選択はその場で効く（下書きを持たない）。外側クリック・Esc で閉じる。
 * ⚠️ 開いているチップは1つだけ（呼び出し側の openChip で持つ。`FilterChip` と同じ約束）。
 */
export function FilterPopoverChip({ label, activeLabel, active, onClear, clearLabel, isOpen, onToggle, width = 320, children, state }: {
  label: string;
  /** 選択中のチップの表示（「経験職種: 営業 +2」） */
  activeLabel: string;
  active: boolean;
  /** ✕ で全部外す */
  onClear: () => void;
  clearLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  width?: number;
  children: ReactNode;
  state?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  /* 外を押したら閉じる・Esc で閉じる */
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onToggle(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onToggle(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [isOpen, onToggle]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} data-state={state}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 999,
          border: `1.5px solid ${active ? "var(--royal)" : "#e2e8f0"}`, background: active ? "var(--royal)" : "#fff",
          color: active ? "#fff" : "var(--ink)", fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer",
          whiteSpace: "nowrap", fontFamily: "inherit", transition: "all 0.12s",
        }}>
        {active && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {active ? activeLabel : label}
        {active ? (
          <span role="button" aria-label={clearLabel} onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ fontSize: 12, marginLeft: 1, opacity: 0.75, lineHeight: 1 }}>✕</span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {isOpen && (
        /* ★位置・大きさは CSS（.fpc-panel）が持つ（2026-10-18）。スマホ（767px 以下）では下から出るシートにする。
              チップの行が横スクロールになったので、absolute のままだと行の外で切れる。
              ⚠️ インラインに戻すとメディアクエリが効かなくなる。幅は --fpc-w で渡すだけ */
        <div role="dialog" aria-label={`${label}で絞り込む`} data-state={state ? `${state}-panel` : undefined}
          className="fpc-panel" style={{ ["--fpc-w" as string]: `${width}px` } as React.CSSProperties}>
          <div className="fpc-sheet-head">
            <span>{label}</span>
            <button type="button" className="btn-fixed-size fpc-sheet-close" onClick={onToggle}>完了</button>
          </div>
          {children}
          <style>{FILTER_OPTION_CSS}</style>
          <style>{FPC_PANEL_CSS}</style>
        </div>
      )}
    </div>
  );
}

/* ⚠️ 引用符・山かっこ・バッククォートを書かないこと（style タグの中。ハイドレーションが壊れる / ui-debugging ⑲） */
const FPC_PANEL_CSS = `
  .fpc-panel { position: absolute; top: calc(100% + 6px); left: 0; z-index: 200; width: var(--fpc-w, 320px); max-width: calc(100vw - 32px);
    max-height: 440px; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box;
    background: #fff; border: 1.5px solid var(--royal); border-radius: 12px; padding: 10px 14px;
    box-shadow: 0 8px 28px rgba(0,35,102,0.14); }
  .fpc-sheet-head { display: none; }
  @media (max-width: 767px) {
    .fpc-panel { position: fixed; top: auto; left: 0; right: 0; bottom: var(--biz-tabbar-h, 0px); width: auto; max-width: none;
      max-height: 70vh; border: 0; border-top: 1px solid var(--line); border-radius: 16px 16px 0 0; padding: 0 16px 16px;
      box-shadow: 0 -8px 30px rgba(0,0,0,0.18); }
    .fpc-sheet-head { display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 1;
      margin: 0 -16px 8px; padding: 12px 8px 8px 16px; background: #fff; border-bottom: 1px solid var(--line-soft);
      font-size: 15px; font-weight: 700; color: var(--ink); }
    .fpc-sheet-close { height: 36px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--royal); color: #fff;
      font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
  }
`;
