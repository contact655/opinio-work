"use client";

// スクロール検知でヒーローを通過した後だけ表示するモバイル用スティッキーCTA
// IntersectionObserver でヒーロー下端のセンチネルを監視する

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  casualHref?: string;
  applyHref: string;
};

export function JobMobileStickyBar({ casualHref, applyHref }: Props) {
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // センチネルが画面外に出たら（ヒーローを過ぎたら）バーを表示
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* センチネル：ヒーロー直下に置いて交差を監視 */}
      <div ref={sentinelRef} style={{ height: 1, pointerEvents: "none" }} aria-hidden="true" />

      {/* スティッキーバー本体（lg 以上は常に非表示） */}
      {/* ⑨ Vertical stacked layout: カジュアル面談 full-width top, 応募する below */}
      <div
        className="lg:hidden"
        style={{
          position: "fixed",
          bottom: 64,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "10px 16px",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
        aria-hidden={!visible}
      >
        {/* 主CTA: カジュアル面談 — full width */}
        {casualHref ? (
        <Link
          href={casualHref}
          tabIndex={visible ? 0 : -1}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 48,
            background: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
            color: "#fff",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          まず社員に話を聞く（無料）
        </Link>
        ) : null}
        {/* 副CTA（面談あり）または 主CTA（面談なし）: 応募する */}
        <Link
          href={applyHref}
          tabIndex={visible ? 0 : -1}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            height: casualHref ? 38 : 48,
            background: casualHref
              ? "transparent"
              : "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
            color: casualHref ? "var(--royal)" : "#fff",
            border: casualHref ? "1.5px solid var(--royal-100)" : "none",
            borderRadius: 10,
            fontSize: casualHref ? 12 : 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: casualHref ? "none" : "0 4px 14px rgba(0,35,102,0.3)",
          }}
        >
          この求人に応募する
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </>
  );
}
