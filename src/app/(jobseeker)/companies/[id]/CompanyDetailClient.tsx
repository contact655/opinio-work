"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Sticky Section Navigation ────────────────────────────────────────────────

type NavItem = { id: string; label: string };

export function CompanyStickyNav({ items }: { items: NavItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

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

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <nav style={{
      position: "sticky", top: 68, zIndex: 40,
      background: "rgba(255,255,255,0.97)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--line)",
      overflowX: "auto",
      scrollbarWidth: "none",
      WebkitOverflowScrolling: "touch" as unknown as undefined,
    }}>
      <div style={{
        display: "flex", gap: 4, padding: "6px 24px",
        maxWidth: "var(--max-w-page)", margin: "0 auto",
        alignItems: "center",
      }} className="px-5 md:px-12">
        {items.map(({ id, label }) => {
          const active = activeId === id;
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              style={{
                padding: "6px 13px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--royal)" : "var(--ink-mute)",
                background: active ? "var(--royal-50)" : "none",
                border: "none",
                borderRadius: 100,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.18s, background 0.18s",
                letterSpacing: active ? "0.01em" : 0,
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
        fontSize: 18,
        transition: "all 0.2s",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}
