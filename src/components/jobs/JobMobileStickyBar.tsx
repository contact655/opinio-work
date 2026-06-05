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
      <div
        className="lg:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "12px 16px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--line)",
          display: "flex",
          gap: 8,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
        aria-hidden={!visible}
      >
        {/* 主CTA: カジュアル面談 (65%) */}
        {casualHref && (
        <Link
          href={casualHref}
          tabIndex={visible ? 0 : -1}
          style={{
            flex: "0 0 65%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 56,
            padding: "0 8px",
            background: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
            color: "#fff",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            textAlign: "center",
            boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
          }}
        >
          カジュアル面談を申し込む
        </Link>
        )}
        {/* 副CTA: 応募する (35%) — 枠線のみ、背景透明 */}
        <Link
          href={applyHref}
          tabIndex={visible ? 0 : -1}
          style={{
            flex: casualHref ? "0 0 calc(35% - 8px)" : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            height: 56,
            padding: "0 8px",
            background: "transparent",
            color: "var(--royal)",
            border: "1.5px solid var(--royal)",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          応募する
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </>
  );
}
