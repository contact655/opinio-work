"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useHideOnScroll } from "@/lib/hooks/useHideOnScroll";

/**
 * ★サーバーのページ（/companies）で、一覧の上部を貼り付け、スマホで下へスクロールしたら隠す入れ物（2026-10-21）。
 *   /people・/jobs はクライアントの部品なので、同じフックを直接呼んでいる。
 */
export function StickyListBar({ style, children }: { style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useHideOnScroll(ref);
  return <div ref={ref} className="lt-sticky" style={style}>{children}</div>;
}
