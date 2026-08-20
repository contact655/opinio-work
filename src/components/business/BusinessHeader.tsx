"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

/*
 * ⚠️ アンカー先が /business に実在することを必ず確かめてから足すこと。
 *    2026-08-21 まで「強み」が `#pricing` を指していたが、そんな id はページに無く、
 *    押しても何も起きなかった（scrollIntoView が `if (el)` で握り潰していた）。
 *    同日、料金セクションに `id="pricing"` を作って実体を与え、項目名も「料金」にした。
 */
const NAV_LINKS = [
  { href: "#pricing", label: "料金" },
  { href: "#flow",    label: "導入の流れ" },
  { href: "#faq",     label: "FAQ" },
];

export function BusinessHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div style={{
        maxWidth: "var(--max-w-page)",
        margin: "0 auto",
        padding: "0 48px",
        height: 60,
        display: "flex",
        alignItems: "center",
        gap: 32,
      }}>

        {/* ── Logo: Opinio + Business badge ── */}
        <Link href="/business" style={{ textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--royal)",
            letterSpacing: "-0.02em",
          }}>
            OPINIO
          </span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 12,
            color: "var(--ink-mute)",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            paddingBottom: 1,
          }}>
            Business
          </span>
        </Link>

        {/* ── Desktop Nav ── */}
        <nav aria-label="ビジネスページナビゲーション" style={{ gap: 24, flex: 1 }} className="hidden md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => {
                const id = href.replace("#", "");
                const el = document.getElementById(id);
                if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
              }}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--ink-soft)",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--royal)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)"; }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* ── Desktop Auth ── */}
        <div style={{ gap: 8, alignItems: "center", flexShrink: 0 }} className="hidden md:flex">
          <Link
            href="/"
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-mute)",
              textDecoration: "none",
              padding: "8px 10px",
              whiteSpace: "nowrap",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-mute)"; }}
          >
            個人の方へ →
          </Link>
          <Link
            href="/biz/auth"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink-soft)",
              textDecoration: "none",
              padding: "8px 14px",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-soft)"; }}
          >
            ログイン
          </Link>
          <Link
            href="/biz/auth"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "var(--royal)",
              textDecoration: "none",
              padding: "8px 18px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            企業を新規登録
          </Link>
        </div>

        {/* ── Mobile: hamburger ── */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 6,
            color: "var(--ink-soft)",
            alignItems: "center",
          }}
          className="flex md:hidden"
          aria-label="メニュー"
        >
          {menuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
        </button>

      </div>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <div
          className="md:hidden"
          style={{
            background: "#fff",
            borderTop: "1px solid var(--line-soft)",
            padding: "16px 24px 24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => {
                  const id = href.replace("#", "");
                  const el = document.getElementById(id);
                  if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
                  setMenuOpen(false);
                }}
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--ink-soft)",
                  textDecoration: "none",
                }}
              >
                {label}
              </a>
            ))}

            <hr style={{ border: "none", borderTop: "1px solid var(--line-soft)", margin: "4px 0" }} />

            <Link
              href="/"
              style={{ fontSize: 13, color: "var(--ink-mute)", textDecoration: "none" }}
              onClick={() => setMenuOpen(false)}
            >
              個人の方へ →
            </Link>
            <Link
              href="/biz/auth"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-soft)", textDecoration: "none" }}
              onClick={() => setMenuOpen(false)}
            >
              ログイン
            </Link>
            <Link
              href="/biz/auth"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px 0",
                background: "var(--royal)",
                color: "#fff",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
              onClick={() => setMenuOpen(false)}
            >
              企業を新規登録（無料）
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
