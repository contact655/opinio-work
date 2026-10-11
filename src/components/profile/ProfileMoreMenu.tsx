"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * ★プロフィールの「…」メニュー（2026-10-11 / 柴さんの指示）。
 *   企業の担当者が /u/[id] を見たとき、主のボタンは会社としての「メッセージを送る」1つにし、
 *   個人としての DM はこの中に「個人としてメッセージを送る」として残す。
 * ⚠️ 中身は開いている間ずっと描いておく（DM を書く画面の状態を消さないため）。外側を押すか Esc で閉じる。
 */
export function ProfileMoreMenu({ children, label = "そのほかの操作" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} data-action="more-menu"
        onClick={() => setOpen((v) => !v)} className="btn-fixed-size"
        style={{ width: 38, height: 38, borderRadius: 8, border: "1.5px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 18, fontWeight: 700, lineHeight: 1, cursor: "pointer", fontFamily: "inherit" }}>
        …
      </button>
      {open && (
        <div id={id} role="menu" style={{ position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 30, minWidth: 220, maxWidth: "calc(100vw - 32px)", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,35,102,0.12)", padding: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}
