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
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "6px 12px",
        marginBottom: 18,
        overflowX: "auto",
        whiteSpace: "nowrap",
        scrollbarWidth: "none",
        display: "flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      <style>{`
        .pn-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-soft);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pn-link:hover {
          background: var(--royal-50);
          color: var(--royal);
        }
        .pn-link.pn-active {
          background: var(--royal-50);
          color: var(--royal);
        }
        .pn-link.pn-active::before {
          content: "";
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--royal);
          margin-right: 4px;
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
