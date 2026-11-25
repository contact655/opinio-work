"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 求人の仕事内容など、長い本文を途中で畳む（2026-11-25 / 見本 /dev/preview/job-points-fold）。
 *
 * - 本文が `maxHeight` を超えるときだけ畳み、下を白くぼかして「続きを読む」を出す
 * - 超えないときは何もしない（ボタンも出さない）
 * - 中身はサーバーで描いたまま子として受け取る。⚠️ 畳んでいても HTML には全文が入っている（検索エンジン・ページ内検索のため）
 */
export function JobBodyFold({ children, maxHeight = 420 }: { children: React.ReactNode; maxHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tooLong, setTooLong] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTooLong(el.scrollHeight > maxHeight + 80);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);

  const folded = tooLong && !open;
  return (
    <div data-state={tooLong ? (open ? "fold-open" : "fold-closed") : "fold-none"}>
      <div ref={ref} style={{ position: "relative", maxHeight: folded ? maxHeight : undefined, overflow: folded ? "hidden" : undefined }}>
        {children}
        {folded && (
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: "linear-gradient(to bottom, rgba(255,255,255,0), #fff)" }} />
        )}
      </div>
      {tooLong && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            marginTop: 12, width: "100%", minHeight: 44, borderRadius: 10,
            border: "1px solid var(--line)", background: "#fff",
            fontSize: 14, fontWeight: 700, color: "var(--royal)", cursor: "pointer",
          }}
        >
          {open ? "閉じる" : "続きを読む"}
        </button>
      )}
    </div>
  );
}
