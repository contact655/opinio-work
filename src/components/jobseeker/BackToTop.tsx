"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * 600px スクロールすると出る「ページトップへ戻る」ボタン。右下に固定する。
 *
 * ⚠️ **`right` / `bottom` をインラインに書かないこと。** 幅で変える値なので
 *    `globals.css` の `.back-to-top` に持たせている（同じ理由が
 *    `companies/[id]` の `MobileBottomCTA` にも書いてある）。
 *    ノッチ端末の横向きで欠けないよう、safe-area も CSS 側で見ている。
 *
 * @param aboveMobileCta 画面下に固定CTAバーを出しているページで true。
 *   企業詳細は `hasMobileBottomCta()` の結果をそのまま渡す。
 *   ⚠️ 渡し忘れるとボタンがCTAバーに重なる（z-index はボタンが上なので、
 *      「募集を見て応募する」の右端を隠す）。
 */
export function BackToTop({ aboveMobileCta = false }: { aboveMobileCta?: boolean } = {}) {
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
      className={`back-to-top${aboveMobileCta ? " back-to-top--above-cta" : ""}`}
      style={{
        position: "fixed",
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
