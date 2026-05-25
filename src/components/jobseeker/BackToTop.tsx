"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * A "Back to top" button that appears after scrolling 600px.
 * Placed in the bottom-right corner, above any FloatingCTA bar.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="ページトップへ戻る"
      style={{
        position: "fixed",
        right: 20,
        bottom: visible ? 88 : 72, // above FloatingCTA on mobile
        zIndex: 90,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "#fff",
        border: "1px solid var(--line)",
        boxShadow: "0 2px 12px rgba(15,23,42,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--ink-soft)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.25s, transform 0.25s",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
