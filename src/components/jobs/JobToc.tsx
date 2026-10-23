"use client";

import { useEffect, useState } from "react";

/**
 * ★募集ページの目次（2026-10-23 / 柴さんの指示。リクルートエージェントのスマホの募集ページを参考にした）。
 *   ページにある見出し（data-toc を付けたまとまり）だけを並べ、押すとそこへ飛ぶ。スマホだけ（lg 以上はサイドバーがある）。
 * ⚠️ タブで切り替える形にしない（「この職種の人」など OPINIO の強みが隠れるため）
 * ⚠️ 見出しは描いたあとに数える。中身の無いまとまりは JobDetailView が描かないので、目次にも出ない
 */
export function JobToc() {
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-toc]"));
    setItems(els.filter((e) => e.id).map((e) => ({ id: e.id, label: e.dataset.toc ?? "" })));
  }, []);
  if (items.length < 2) return null;
  return (
    <nav aria-label="この募集の目次" data-state="job-toc" className="lg:hidden"
      style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 4px", minWidth: 0, maxWidth: "100%", scrollbarWidth: "none" }}>
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`}
          style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff",
            fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none", whiteSpace: "nowrap" }}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
