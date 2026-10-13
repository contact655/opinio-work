"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
        <div role="dialog" aria-label={`${label}で絞り込む`} data-state={state ? `${state}-panel` : undefined}
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, width, maxWidth: "calc(100vw - 32px)",
            maxHeight: 440, overflowY: "auto", overscrollBehavior: "contain",
            background: "#fff", border: "1.5px solid var(--royal)", borderRadius: 12, padding: "10px 14px",
            boxShadow: "0 8px 28px rgba(0,35,102,0.14)",
          }}>
          {children}
          <style>{FILTER_OPTION_CSS}</style>
        </div>
      )}
    </div>
  );
}
