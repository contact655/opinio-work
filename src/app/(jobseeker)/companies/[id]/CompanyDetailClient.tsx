"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRecentlyViewed } from "@/lib/hooks/useRecentlyViewed";

// ─── RecentlyViewedTracker ─────────────────────────────────────────────────────

export function RecentlyViewedTracker({ id, name, logoUrl, logoLetter }: {
  id: string; name: string; logoUrl?: string | null; logoLetter?: string;
}) {
  const { addItem } = useRecentlyViewed();
  useEffect(() => {
    addItem({ type: "company", id, name, logoUrl, logoLetter });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ─── Sticky Section Navigation ────────────────────────────────────────────────

type NavItem = { id: string; label: string };

export function CompanyStickyNav({ items }: { items: NavItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const navRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  // アクティブなタブを自動スクロールで中央に表示
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
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <nav
      ref={navRef}
      style={{
        position: "sticky", top: 68, zIndex: 40,
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
        {items.map(({ id, label }) => {
          const active = activeId === id;
          return (
            <button
              type="button"
              key={id}
              ref={(el) => { if (el) btnRefs.current.set(id, el); }}
              onClick={() => scrollTo(id)}
              style={{
                padding: "6px 13px",
                fontSize: "var(--text-sm)",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--royal)" : "var(--ink-mute)",
                background: active ? "var(--royal-50)" : "none",
                border: "none",
                borderRadius: 100,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.18s, background 0.18s",
                letterSpacing: active ? "0.01em" : 0,
                flexShrink: 0,
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

export default function BookmarkButton({
  companyName,
  companyId,
  initialBookmarked,
  isAuthenticated,
}: {
  companyName: string;
  companyId: string;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Optimistic update
    const next = !bookmarked;
    setBookmarked(next);
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "company", target_id: companyId }),
      });
      if (!res.ok) setBookmarked(!next); // revert on failure
    } catch {
      setBookmarked(!next); // revert on network error
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? "ブックマーク済み" : `${companyName}をブックマーク`}
      style={{
        width: 40,
        height: 40,
        border: `1px solid ${bookmarked ? "var(--warm)" : "var(--line)"}`,
        background: bookmarked ? "var(--warm-soft)" : "#fff",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: bookmarked ? "var(--warm)" : "var(--ink-soft)",
        cursor: loading ? "default" : "pointer",
        transition: "all 0.2s",
        opacity: loading ? 0.6 : 1,
      }}
      aria-label={bookmarked ? "ブックマーク済み" : `${companyName}をブックマーク`}
      aria-pressed={bookmarked}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
