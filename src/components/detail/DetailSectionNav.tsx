"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ★企業詳細・募集詳細のページ内タブ（2026-11-26 / 柴さんの指示。2ページで同じ部品）。
 *   それまでの企業ページの CompanyStickyNav を移した。
 *
 * ⚠️ タブに数字を入れない（2026-11-26 に「募集」の件数を外した）。
 * ⚠️ 中身の無いセクションは呼び出し側で items から外す（押しても何も無いタブを出さない）。
 * ⚠️ 貼り付く位置（top）は globals.css の .cd-sticky-nav が持つ。インラインに戻さないこと。
 *
 * @param aliases タブに無いセクションを、どのタブとして点けるか（企業ページの OB/OG → 「働く人」など）。
 *   値を空文字にすると「そのセクションではどのタブにも下線を付けない」（企業ページの「公式の発信」。2026-11-28）
 */
export type DetailNavItem = { id: string; label: string };

const NO_ALIASES: Record<string, string> = {};

export function DetailSectionNav({ items, aliases = NO_ALIASES }: { items: DetailNavItem[]; aliases?: Record<string, string> }) {
  const [activeId, setActiveId] = useState<string>("");
  const navRef = useRef<HTMLElement>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const ids = items.map((i) => i.id);
    // 別名は「行き先のタブがあり（または空文字＝どのタブでもない）、自分自身はタブに無い」ものだけ見張る
    const watchIds = [...ids, ...Object.keys(aliases).filter((k) => (aliases[k] === "" || ids.includes(aliases[k])) && !ids.includes(k))];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(aliases[entry.target.id] ?? entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    /* ★後から描かれるセクションも拾う（2026-10-03）。社員のセクションなどはブラウザで API を引いてから描くので、
          最初の1回だけ getElementById すると監視から漏れる。全部見つかったら MutationObserver は外す。 */
    const observed = new Set<Element>();
    const attach = () => {
      for (const id of watchIds) {
        const el = document.getElementById(id);
        if (el && !observed.has(el)) {
          observer.observe(el);
          observed.add(el);
        }
      }
      if (observed.size >= watchIds.length) mutation.disconnect();
    };
    const mutation = new MutationObserver(attach);
    mutation.observe(document.body, { childList: true, subtree: true });
    attach();

    return () => {
      mutation.disconnect();
      observer.disconnect();
    };
  }, [items, aliases]);

  // アクティブなタブを横スクロールで中央に寄せる
  useEffect(() => {
    if (!activeId) return;
    const nav = navRef.current;
    const btn = btnRefs.current.get(activeId);
    if (!nav || !btn) return;
    const navCenter = nav.scrollLeft + nav.clientWidth / 2;
    const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
    nav.scrollTo({ left: btnCenter - navCenter + nav.scrollLeft, behavior: "smooth" });
  }, [activeId]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    /* 見出しがタブの下に隠れないよう、タブの貼り付く位置＋高さから決める（2026-10-29） */
    const nav = navRef.current;
    const offset = nav ? (parseFloat(getComputedStyle(nav).top) || 0) + nav.offsetHeight + 8 : 100;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className="cd-sticky-nav"
      aria-label="ページ内の目次"
      style={{
        position: "sticky", zIndex: 40,
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
        overflowX: "auto",
      }}
    >
      <div
        className="sticky-nav"
        style={{
          display: "flex", gap: 4,
          paddingTop: "6px", paddingBottom: "6px",
          maxWidth: "var(--max-w-wide)", margin: "0 auto",
          alignItems: "center",
          width: "max-content", minWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* ⚠️ 選択状態は下線だけで表す（2026-08-23） */}
        {items.map(({ id, label }) => {
          const active = activeId === id;
          return (
            <button
              type="button"
              key={id}
              ref={(el) => { if (el) btnRefs.current.set(id, el); }}
              onClick={() => scrollTo(id)}
              aria-current={active ? "location" : undefined}
              style={{
                display: "inline-flex", alignItems: "center",
                padding: "6px 13px",
                fontSize: "var(--text-sm)",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--royal)" : "var(--ink-mute)",
                background: "none", border: "none",
                borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
                borderRadius: 0, cursor: "pointer", whiteSpace: "nowrap",
                transition: "color 0.18s, border-color 0.18s",
                flexShrink: 0, marginBottom: -1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
