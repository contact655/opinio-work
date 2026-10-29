"use client";

import { useState, useEffect, useRef } from "react";
import type React from "react";
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
          color: copied ? "var(--success-ink)" : "var(--ink-mute)",
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
    /* ★タブに無いセクションを、どのタブとして扱うか（2026-10-03）。
       OB/OG（#alumni）はタブを持たず「社員・OB/OG」タブの一部なので、そちらを点ける。
       ⚠️ これが無いと、OB/OG を見ている間は直前のタブ（現役社員より上の「働く環境」など）が
          点いたままになる。 */
    const ALIAS: Record<string, string> = { alumni: "current-employees" };
    const ids = items.map((i) => i.id);
    // 別名は「行き先のタブがあり、自分自身はタブに無い」ものだけ見張る
    const watchIds = [...ids, ...Object.keys(ALIAS).filter((k) => ids.includes(ALIAS[k]) && !ids.includes(k))];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(ALIAS[entry.target.id] ?? entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    /* ★★**後から描かれるセクションも拾う**（2026-10-03）。
       現役社員・OB/OG（CompanyEmployeeSections）は**ブラウザで API を引いてから描く**ので、
       この effect が走った時点ではまだ DOM に無い（サーバーの HTML に id が0件）。
       ⚠️ 最初の1回だけ getElementById していたため、**社員のセクションは一度も監視されず**、
          スクロールしてもタブが「働く環境」のまま動かなかった。
       ⚠️ 全部見つかったら MutationObserver は外す（DOM の変化を見張り続けない）。 */
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
    /* ★見出しがタブの下に隠れないよう、タブの貼り付く位置＋高さから決める（2026-10-29）。
          それまでは 100 の即値で、タブ（約56px）と合わせると16px ほど足りなかった */
    const nav = navRef.current;
    const offset = nav ? (parseFloat(getComputedStyle(nav).top) || 0) + nav.offsetHeight + 8 : 100;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    /* ★貼り付く位置（top）は globals.css の .cd-sticky-nav が持つ（2026-10-29）。
          ⚠️ インラインに戻さないこと（幅で変えられなくなる） */
    <nav
      ref={navRef}
      className="cd-sticky-nav"
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
              /* 選択中のタブ。読み上げに伝えるのと、検証で文字列を当てずに判定するため（2026-10-03） */
              aria-current={active ? "location" : undefined}
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

/** @param tone primary … 未フォローのときに青い枠（主なボタンとして目立たせる。ホームの企業カード。2026-10-19） */
export function FollowButton({ companyId, tone = "default" }: { companyId: string; tone?: "default" | "primary" }) {
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
        border: tone === "primary" && !followed ? "1.5px solid var(--royal)" : `1px solid ${followed ? "var(--royal)" : "var(--line)"}`,
        background: followed ? "var(--royal-50)" : "rgba(255,255,255,0.9)",
        color: followed || tone === "primary" ? "var(--royal)" : "var(--ink-soft)",
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
  /** heart … 丸いハートのアイコンだけ（ホームの企業カード。主なボタン「フォロー」の横に控えめに置く。2026-10-19） */
  variant?: "icon" | "pill" | "heart";
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

  if (variant === "heart") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="btn-fixed-size"
        title={bookmarked ? "保存済" : `${companyName}を保存`}
        aria-label={bookmarked ? "保存済" : `${companyName}を保存`}
        aria-pressed={bookmarked}
        style={{
          width: 34, height: 34, borderRadius: "50%", padding: 0, flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${bookmarked ? "var(--royal-100)" : "var(--line)"}`,
          background: bookmarked ? "var(--royal-50)" : "#fff",
          color: bookmarked ? "var(--royal)" : "var(--ink-soft)",
          cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
    );
  }

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

// ─── CompanyMoreMenu（スマホの「…」。2026-10-17）──────────────────────────────
/**
 * ★スマホ（767px 以下）だけ、公式サイト・採用情報・X・LinkedIn・共有を「…」の中にまとめる（LinkedIn型）。
 *   それまでは保存・フォローの下にもう1行あり、アクションが2行に折り返していた。
 * ⚠️ 768px 以上は従来どおり横に並べる（このボタンは `.cd-more` で出さない）。
 * ⚠️ 共有は端末の共有シート（navigator.share）。使えない端末ではリンクをコピーする。
 */
export function CompanyMoreMenu({ companyName, companyId, links }: {
  companyName: string;
  companyId: string;
  links: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function share() {
    const url = `${window.location.origin}/companies/${companyId}`;
    try {
      if (navigator.share) { await navigator.share({ title: companyName, url }); setOpen(false); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1200);
    } catch { /* 共有シートを閉じただけ。何もしない */ }
  }

  const itemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", width: "100%", minHeight: 48, padding: "0 20px",
    fontSize: 15, fontWeight: 600, color: "var(--ink)", textDecoration: "none",
    background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
  };

  return (
    <div ref={ref} className="cd-more" style={{ position: "relative" }}>
      <button type="button" aria-label="その他の操作" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="btn-fixed-size"
        style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
      {open && (
        <div role="menu" style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1300,
          background: "#fff", borderRadius: "16px 16px 0 0",
          padding: "8px 0 calc(12px + env(safe-area-inset-bottom))",
          boxShadow: "0 0 0 100vmax rgba(15,23,42,0.35)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", padding: "8px 20px" }}>{companyName}</div>
          {links.map((l) => (
            <a key={l.href} role="menuitem" href={l.href} target="_blank" rel="noopener noreferrer" style={itemStyle} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={share} style={itemStyle}>
            {copied ? "リンクをコピーしました ✓" : "共有する"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CtaReveal（スマホの固定バーを、上部が見えている間は隠す。2026-10-17）────────
/**
 * ★企業ページの上部（社名・保存・フォローのある帯）が見えている間は、下の固定バー
 *   （募集を見る／話を聞く）を隠す。上部と下部で同じ種類の操作が2段に並び、
 *   最初の画面の下端を2本のバー（固定バー＋タブバー）が塞いでいたため（柴さんの指示）。
 * ⚠️ 判定は `[data-cd-hero]` の IntersectionObserver。見つからなければ出す側に倒す。
 * ⚠️ 隠すのは見た目と操作だけ（`aria-hidden` / `inert`）。下余白（body の padding）は変えない。
 */
export function CtaReveal({ children }: { children: React.ReactNode }) {
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => {
    const el = document.querySelector("[data-cd-hero]");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { rootMargin: "0px 0px -40% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`cd-cta-reveal${heroVisible ? " is-hidden" : ""}`} aria-hidden={heroVisible || undefined}>
      {children}
    </div>
  );
}
