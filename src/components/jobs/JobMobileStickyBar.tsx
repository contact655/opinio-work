"use client";

/**
 * 求人ページの下の固定バー（1023px 以下）。ヘッダーカードを過ぎたら出す。
 *
 * ★2026-11-26 に［話を聞いてみたい］［応募する］の2つを横に並べる形にした（柴さんの指示）。
 *   保存はヘッダーカードのボタンにあるので、ここには置かない。
 * ⚠️ ボタンの出し分けはヘッダーカード（JobDetailView の JobHeaderActions）と同じ props を渡す。
 *    片方だけに条件を足さないこと。
 * ⚠️ どちらも出せないならバーごと出さない（空の固定バーが本文を隠すだけになる）。
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MEETING_CTA_BG, MEETING_CTA_FG, MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";

type Props = {
  /** カジュアル面談の申込先。受け付けない企業では undefined */
  casualHref?: string;
  /** 応募先。応募を受けない企業では undefined（lib/jobs/application.ts） */
  applyHref?: string;
};

export function JobMobileStickyBar({ casualHref, applyHref }: Props) {
  const hasAnyCta = !!casualHref || !!applyHref;
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const base: React.CSSProperties = {
    flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center",
    height: 46, borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
  };

  return (
    <>
      {/* センチネル：ヘッダーカードの直下に置いて交差を監視 */}
      <div ref={sentinelRef} style={{ height: 1, pointerEvents: "none" }} aria-hidden="true" />
      {hasAnyCta && (
        <div
          className="lg:hidden"
          data-state="job-sticky-bar"
          style={{
            position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 50,
            background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--line)",
            transform: visible ? "translateY(0)" : "translateY(100%)",
            transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)", willChange: "transform",
          }}
          aria-hidden={!visible}
        >
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "10px 16px", display: "flex", gap: 8 }}>
            {casualHref && (
              <Link href={casualHref} tabIndex={visible ? 0 : -1} style={{
                ...base, background: MEETING_CTA_BG, color: MEETING_CTA_FG,
                boxShadow: `0 4px 14px rgba(${MEETING_CTA_SHADOW_RGB},0.35)`,
              }}>
                話を聞いてみたい
              </Link>
            )}
            {applyHref && (
              <Link href={applyHref} tabIndex={visible ? 0 : -1} style={casualHref
                ? { ...base, background: "#fff", color: "var(--royal)", border: "1.5px solid var(--royal)" }
                : { ...base, background: "var(--royal)", color: "#fff" }}>
                応募する
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
