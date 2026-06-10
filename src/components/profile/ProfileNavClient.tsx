"use client";

import { useEffect, useState } from "react";

export interface NavSection {
  id: string;
  label: string;
}

/**
 * スクロールスパイ付きセクションナビゲーション。
 * IntersectionObserver でアクティブセクションを検知し、対応するリンクをハイライト。
 */
export function ProfileNavClient({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    if (sections.length === 0) return;

    const visibleIds = new Set<string>();

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id);
          } else {
            visibleIds.delete(entry.target.id);
          }
        }
        // 複数セクションが可視の場合、sections の順番で最初のものをアクティブに
        const first = sections.find((s) => visibleIds.has(s.id));
        if (first) setActive(first.id);
      },
      // 上端から5%〜下端から60%の帯域でアクティブ判定（35%帯域 = 検知しやすい）
      { rootMargin: "-5% 0px -60% 0px", threshold: 0 }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((s) => s.id).join(",")]);

  if (sections.length === 0) return null;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  };

  return (
    <nav
      style={{
        background: "#fff",
        borderBottom: "1px solid var(--line)",
        padding: "0 2px",
        marginBottom: 18,
        overflowX: "auto",
        whiteSpace: "nowrap",
        scrollbarWidth: "none",
        display: "flex",
        alignItems: "center",
        gap: 0,
      }}
    >
      <style>{`
        .pn-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          padding-bottom: 10px;
          border-radius: 0;
          border-bottom: 3px solid transparent;
          margin-bottom: -1px;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-soft);
          text-decoration: none;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pn-link:hover {
          color: var(--royal);
          border-bottom-color: var(--royal-100);
          background: var(--royal-50);
        }
        .pn-link.pn-active {
          color: var(--royal);
          font-weight: 700;
          border-bottom-color: var(--royal);
          background: var(--royal-50);
        }
        nav::-webkit-scrollbar { display: none; }
      `}</style>
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`pn-link${active === id ? " pn-active" : ""}`}
          onClick={(e) => handleClick(e, id)}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
