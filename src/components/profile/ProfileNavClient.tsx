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

    const cleanup: (() => void)[] = [];

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActive(id);
          }
        },
        // 上端から20%〜下端から75%の帯域でアクティブ判定（スクロール中に自然に切り替わる）
        { rootMargin: "-20% 0px -75% 0px", threshold: 0 }
      );
      obs.observe(el);
      cleanup.push(() => obs.disconnect());
    });

    return () => cleanup.forEach((fn) => fn());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((s) => s.id).join(",")]);

  if (sections.length === 0) return null;

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
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-soft);
          text-decoration: none;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pn-link:hover {
          color: var(--royal);
          border-bottom-color: var(--royal-100);
        }
        .pn-link.pn-active {
          color: var(--royal);
          font-weight: 700;
          border-bottom-color: var(--royal);
        }
        nav::-webkit-scrollbar { display: none; }
      `}</style>
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`pn-link${active === id ? " pn-active" : ""}`}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
