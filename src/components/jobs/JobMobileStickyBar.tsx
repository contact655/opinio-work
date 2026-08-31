"use client";

// スクロール検知でヒーローを通過した後だけ表示するモバイル用スティッキーCTA
// IntersectionObserver でヒーロー下端のセンチネルを監視する

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MEETING_CTA_BG, MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";

type Props = {
  casualHref?: string;
  /** 宛先がある企業のときだけ渡す。undefined なら応募ボタンを出さない
   *  ⚠️ published でも応募が届く先があるとは限らない（lib/jobs/application.ts） */
  applyHref?: string;
};

export function JobMobileStickyBar({ casualHref, applyHref }: Props) {
  /* ⚠️ どちらのCTAも出せないなら、バーごと出さない（2026-08-11）。
        空の固定バーが画面下に居座り、コンテンツを隠すだけになる。 */
  const hasAnyCta = !!casualHref || !!applyHref;
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
      {hasAnyCta && (
      <div
        className="lg:hidden"
        style={{
          position: "fixed",
          bottom: 64,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--line)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
        aria-hidden={!visible}
      >
        <div style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
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
            background: MEETING_CTA_BG,
            color: "#fff",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: `0 4px 14px rgba(${MEETING_CTA_SHADOW_RGB},0.35)`,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>話を聞く<span style={{ whiteSpace: "nowrap" }}>（カジュアル面談）</span></span>
        </Link>
        ) : null}
        {/* 副CTA（面談あり）または 主CTA（面談なし）: 応募する */}
        {applyHref ? (
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
        ) : null}
        </div>
      </div>
      )}
    </>
  );
}
