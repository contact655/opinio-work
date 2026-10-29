"use client";

// スクロール検知でヒーローを通過した後だけ表示するモバイル用スティッキーCTA
// IntersectionObserver でヒーロー下端のセンチネルを監視する

import { useEffect, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { MEETING_CTA_BG, MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";

type Props = {
  casualHref?: string;
  /** 宛先がある企業のときだけ渡す。undefined なら応募ボタンを出さない
   *  ⚠️ published でも応募が届く先があるとは限らない（lib/jobs/application.ts） */
  applyHref?: string;
  /** ★保存（2026-10-17）。同じ理由でスマホに無かった。渡すと右端に ♡ を出す */
  saveJobId?: string;
};

export function JobMobileStickyBar({ casualHref, applyHref, saveJobId }: Props) {
  /* ⚠️ どれも出せないなら、バーごと出さない（2026-08-11）。
        空の固定バーが画面下に居座り、コンテンツを隠すだけになる。 */
  const hasAnyCta = !!casualHref || !!applyHref || !!saveJobId;
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
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          flex: 1,
          minWidth: 0,
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
          {/* ★矢印は外した（2026-10-29）。上部のボタン（JobMobileHeroActions）と文言をそろえる */}
          この募集に応募する
        </Link>
        ) : null}
        {/* ⚠️「企業の採用ページで応募する」（外部リンク）は 2026-10-27 に外した（柴さんの決定） */}
        </div>
        {saveJobId && (
          <div style={{ flexShrink: 0 }}>
            <BookmarkButton targetType="job" targetId={saveJobId} label="保存する" />
          </div>
        )}
        </div>
      </div>
      )}
    </>
  );
}

/**
 * ★求人詳細の上部（タイトルと条件の下）に出す、スマホの操作の行（2026-10-17 / 柴さんの指示）。
 *   下の固定バーは上部を過ぎてから出るので、最初の画面に押せるものが1つも無かった。
 * ⚠️ 中身は固定バーと**同じ props・同じ条件**（話を聞く／この募集に応募する／企業の採用ページで応募する＋保存）。
 *    片方だけ変えないこと。lg 以上はサイドバーがあるので出さない。
 * ⚠️ `display` はインラインに書かない（lg:hidden が効かなくなる）。外側は class だけ、中を flex にする。
 */
export function JobMobileHeroActions({ casualHref, applyHref, saveJobId }: Props) {
  const primary = casualHref
    ? { href: casualHref, label: "話を聞く（カジュアル面談）", external: false, kind: "meeting" as const }
    : applyHref
    ? { href: applyHref, label: "この募集に応募する", external: false, kind: "apply" as const }
    : null;
  if (!primary && !saveJobId) return null;
  const style: React.CSSProperties = primary?.kind === "meeting"
    ? { background: MEETING_CTA_BG, color: "#fff", border: "none" }
    : primary?.kind === "apply"
    ? { background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)", color: "#fff", border: "none" }
    : { background: "#fff", color: "var(--royal)", border: "1.5px solid var(--royal-100)" };
  const common: React.CSSProperties = {
    flex: 1, minWidth: 0, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
    fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...style,
  };
  return (
    <div className="lg:hidden" data-state="job-hero-actions" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {primary && (primary.external ? (
          <a href={primary.href} target="_blank" rel="noopener noreferrer nofollow" style={common}>
            {primary.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path d="M7 17L17 7M8 7h9v9" /></svg>
          </a>
        ) : (
          <Link href={primary.href} style={common}>{primary.label}</Link>
        ))}
        {saveJobId && (
          <div style={{ flexShrink: 0 }}>
            <BookmarkButton targetType="job" targetId={saveJobId} label="保存する" />
          </div>
        )}
      </div>
    </div>
  );
}
