"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/hooks/useRecentlyViewed";

// ─── ShareButton ───────────────────────────────────────────────────────────────

export function ShareButton({ companyName, companyId }: { companyName: string; companyId: string }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://opinio.jp");
  // set origin on client to avoid hydration mismatch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shareUrl = `${origin}/companies/${companyId}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${companyName} — OPINIOで企業情報をチェック`)}&url=${encodeURIComponent(`https://opinio.jp/companies/${companyId}`)}`;

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600,
          background: copied ? "var(--success-soft)" : "var(--bg-tint)",
          color: copied ? "var(--success)" : "var(--ink-mute)",
          border: `1px solid ${copied ? "#A7F3D0" : "var(--line)"}`,
          cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        {copied ? "コピー済み ✓" : "URLをコピー"}
      </button>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 11px", borderRadius: 100, fontSize: 11, fontWeight: 700,
          background: "#000", color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        X でシェア
      </a>
    </div>
  );
}

// ─── EmployeeAvatarImg ─────────────────────────────────────────────────────────
// Server Componentから画像エラーハンドラーを使うためのClientラッパー

export function EmployeeAvatarImg({
  src, alt, fallbackBg, fallbackText, fallbackColor, fontSize = 22,
}: {
  src: string; alt: string; fallbackBg: string; fallbackText: string; fallbackColor: string; fontSize?: number;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: fallbackBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: fallbackColor, fontWeight: 700, fontSize,
      }}>
        {fallbackText}
      </div>
    );
  }
  return (
    <Image src={src} alt={alt} fill onError={() => setErrored(true)} style={{ objectFit: "cover" }} />
  );
}

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
          const isJobs = id === "jobs";
          const activeColor = isJobs ? "#D97706" : "var(--royal)";
          const inactiveBg = isJobs ? "#FEF3C7" : "none";
          return (
            <button
              type="button"
              key={id}
              ref={(el) => { if (el) btnRefs.current.set(id, el); }}
              onClick={() => scrollTo(id)}
              style={{
                padding: isJobs ? "5px 13px" : "6px 13px",
                fontSize: "var(--text-sm)",
                fontWeight: isJobs ? 700 : (active ? 700 : 500),
                color: active ? activeColor : (isJobs ? "#92400E" : "var(--ink-mute)"),
                background: active && isJobs ? "#FDE68A" : (isJobs ? inactiveBg : "none"),
                border: isJobs ? `1px solid ${active ? "#FCD34D" : "#FDE68A"}` : "none",
                borderBottom: !isJobs ? (active ? `2px solid ${activeColor}` : "2px solid transparent") : "none",
                borderRadius: isJobs ? 6 : 0,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.18s, border-color 0.18s, background 0.18s",
                letterSpacing: active ? "0.01em" : 0,
                flexShrink: 0,
                marginBottom: isJobs ? 0 : -1,
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
  variant = "icon",
}: {
  companyName: string;
  companyId: string;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
  variant?: "icon" | "pill";
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

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700,
          border: `1px solid ${bookmarked ? "var(--warm)" : "var(--line)"}`,
          background: bookmarked ? "var(--warm-soft)" : "rgba(255,255,255,0.9)",
          color: bookmarked ? "#92400E" : "var(--ink-soft)",
          cursor: loading ? "default" : "pointer",
          transition: "all 0.2s",
          opacity: loading ? 0.7 : 1,
        }}
        aria-pressed={bookmarked}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        {bookmarked ? "気になり済み" : "気になる"}
      </button>
    );
  }

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
