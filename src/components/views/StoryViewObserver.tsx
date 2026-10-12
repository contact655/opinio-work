"use client";

import { useEffect, useRef } from "react";

/**
 * ★企業ストーリーの閲覧を数えてもらう（2026-10-12）。企業ページのストーリーのカードを包む。
 *
 * ストーリーには自分のページが無く、企業ページの中に並ぶだけなので、
 * **カードの半分以上が1秒続けて画面に出たら**1回 `POST /api/views`（type: story）を呼ぶ。
 * 数えるかどうか（ボット・検証用・運営・その会社の担当者・同じ日の2回目）はサーバーが決める
 * （`lib/views/decide.ts`）。⚠️ ここで判定を足さないこと。
 * ⚠️ IntersectionObserver が無いブラウザでは数えない（推測で送らない）。
 * ⚠️ 失敗しても画面には何も出さない。
 */
export function StoryViewObserver({ id, enabled = true, children }: { id: string; enabled?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || sent.current || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
      if (visible && !timer) {
        timer = setTimeout(() => {
          if (sent.current) return;
          sent.current = true;
          io.disconnect();
          fetch("/api/views", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "story", id }), keepalive: true,
          }).catch(() => { /* 記録の失敗は利用者に関係しない */ });
        }, 1000);
      } else if (!visible && timer) {
        clearTimeout(timer);
        timer = null;
      }
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); };
  }, [id, enabled]);
  return <div ref={ref} data-story-id={id}>{children}</div>;
}
