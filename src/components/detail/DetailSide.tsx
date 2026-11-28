"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * ★企業詳細・募集詳細の右側の欄（2026-11-28 / 柴さんの指示）。
 *   1024px 以上で、欄**全体**をヘッダーとタブの下に貼り付ける。
 *   欄全体が画面に収まらないときは貼り付けない（下の方が永久に見えなくなるため）。
 *
 * ⚠️ それまでは一番上の行動カード（.dt-action）だけを貼り付けていたため、
 *    スクロールすると下の「似ている企業」などの上に重なって中身を隠していた。
 *    行動カードだけを貼り付ける形に戻さないこと。
 * ⚠️ 中身（話せる人など）はブラウザで後から描かれて高さが変わるので、ResizeObserver で測り直す。
 * ⚠️ 貼り付く位置と幅の条件は globals.css の .dt-side[data-fit] が持つ。ここの STICKY_TOP と合わせること。
 */
const STICKY_TOP = 132;
const BOTTOM_GAP = 16;

export function DetailSide({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  const ref = useRef<HTMLElement>(null);
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setFits(el.offsetHeight + STICKY_TOP + BOTTOM_GAP <= window.innerHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <aside ref={ref} className="dt-side" data-fit={fits ? "true" : "false"} aria-label={ariaLabel}>
      {children}
    </aside>
  );
}
