"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/hooks/useRecentlyViewed";
import {
  useCompanyViewerState,
  invalidateCompanyViewerState,
} from "@/lib/companies/useCompanyViewerState";

// ─── ShareButton ───────────────────────────────────────────────────────────────

export function ShareButton({ companyName, companyId }: { companyName: string; companyId: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("https://opinio.jp");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const shareUrl = `${origin}/companies/${companyId}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${companyName} — OPINIOで企業情報をチェック`)}&url=${encodeURIComponent(`https://opinio.jp/companies/${companyId}`)}`;

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setOpen(false);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 11px", borderRadius: 100, fontSize: 12, fontWeight: 600,
          background: copied ? "var(--success-soft)" : "var(--bg-tint)",
          color: copied ? "var(--success)" : "var(--ink-mute)",
          border: `1px solid ${copied ? "#A7F3D0" : "var(--line)"}`,
          cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        {copied ? "コピー済み ✓" : "共有"}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          overflow: "hidden", zIndex: 50, minWidth: 144,
        }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "10px 14px", fontSize: 12, fontWeight: 600,
              background: "transparent", border: "none", color: "var(--ink)",
              cursor: "pointer", textAlign: "left",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            URLをコピー
          </button>
          <div style={{ height: 1, background: "var(--line)", margin: "0 10px" }} />
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", fontSize: 12, fontWeight: 600,
              color: "var(--ink)", textDecoration: "none",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X でシェア
          </a>
        </div>
      )}
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

/**
 * @property count 件数バッジ。**求人タブだけが使う**。
 *   0 や undefined のときはバッジごと出さない（「0」を見せない）。
 */
type NavItem = { id: string; label: string; count?: number };

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
        {/* ⚠️ **選択状態は下線だけで表す（2026-08-23）。**
               以前は求人タブだけ黄色の塗り（`isJobs` 分岐）で、下線の付いたタブと
               同時に存在していた。選択状態が2つあるように見えるうえ、
               塗りのほうが強いので「求人が選ばれている」と誤読される。
               件数は塗りではなく、ラベル右のニュートラルなバッジで示す。 */}
        {items.map(({ id, label, count }) => {
          const active = activeId === id;
          return (
            <button
              type="button"
              key={id}
              ref={(el) => { if (el) btnRefs.current.set(id, el); }}
              onClick={() => scrollTo(id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 13px",
                fontSize: "var(--text-sm)",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--royal)" : "var(--ink-mute)",
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
                borderRadius: 0,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.18s, border-color 0.18s",
                letterSpacing: active ? "0.01em" : 0,
                flexShrink: 0,
                marginBottom: -1,
              }}
            >
              {label}
              {typeof count === "number" && count > 0 && (
                <span
                  style={{
                    /* ⚠️ 12px 未満にしない（2026-08-30）。 */
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1,
                    padding: "3px 6px",
                    borderRadius: 999,
                    background: "var(--line-soft)",
                    color: "var(--ink-mute)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── FollowButton ─────────────────────────────────────────────────────────────

export function FollowButton({ companyId }: { companyId: string }) {
  /* ⚠️ 状態はサーバーから props で受け取らずここで取る。
        サーバーで引くとページ全体が動的化して ISR が効かなくなるため。 */
  const viewer = useCompanyViewerState(companyId);
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 取得が終わったら反映する（それまでは未フォロー表示＝サーバーHTMLと同じ）
  useEffect(() => {
    if (viewer.ready) setFollowed(viewer.following);
  }, [viewer.ready, viewer.following]);

  const toggle = async () => {
    if (!viewer.ready) return;            // 取得前は押せても状態が確定しないので待つ
    if (!viewer.authenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const next = !followed;
    setFollowed(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/jobseeker/companies/${companyId}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) setFollowed(!next);
      else invalidateCompanyViewerState(companyId);
    } catch {
      setFollowed(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700,
        border: `1px solid ${followed ? "var(--royal)" : "var(--line)"}`,
        background: followed ? "var(--royal-50)" : "rgba(255,255,255,0.9)",
        color: followed ? "var(--royal)" : "var(--ink-soft)",
        cursor: loading ? "default" : "pointer",
        transition: "all 0.2s",
        opacity: loading ? 0.7 : 1,
      }}
      aria-pressed={followed}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill={followed ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {followed ? "フォロー中" : "フォロー"}
    </button>
  );
}

export default function BookmarkButton({
  companyName,
  companyId,
  variant = "icon",
}: {
  companyName: string;
  companyId: string;
  variant?: "icon" | "pill";
}) {
  // ⚠️ FollowButton と同じ取得を共有する（企業IDごとに1本しか飛ばない）
  const viewer = useCompanyViewerState(companyId);
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (viewer.ready) setBookmarked(viewer.bookmarked);
  }, [viewer.ready, viewer.bookmarked]);

  const toggle = async () => {
    if (!viewer.ready) return;
    if (!viewer.authenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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
      else invalidateCompanyViewerState(companyId);
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
          /* ⚠️ 保存済みは royal（2026-08-30。`components/jobseeker/BookmarkButton.tsx` と揃える）。 */
          border: `1px solid ${bookmarked ? "var(--royal-100)" : "var(--line)"}`,
          background: bookmarked ? "var(--royal-50)" : "rgba(255,255,255,0.9)",
          color: bookmarked ? "var(--royal)" : "var(--ink-soft)",
          cursor: loading ? "default" : "pointer",
          transition: "all 0.2s",
          opacity: loading ? 0.7 : 1,
        }}
        aria-pressed={bookmarked}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        {/* ⚠️ 語彙は /jobs の保存ボタンと揃える（「保存」/「保存済」）。 */}
        {bookmarked ? "保存済" : "保存"}
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
        border: `1px solid ${bookmarked ? "var(--royal-100)" : "var(--line)"}`,
        background: bookmarked ? "var(--royal-50)" : "#fff",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: bookmarked ? "var(--royal)" : "var(--ink-soft)",
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
