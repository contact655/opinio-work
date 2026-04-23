"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";

// ─── Design tokens ──────────────────────────────────────
const ROYAL      = "#002366";
const INK_SOFT   = "#475569";
const INK        = "#0F172A";
const LINE       = "#E2E8F0";

// ─── Nav items ──────────────────────────────────────────
const NAV_ITEMS = [
  { href: "/jobs",                 label: "求人を探す" },
  { href: "/companies",            label: "企業を知る" },
  { href: "/career-consultation",  label: "先輩に相談" },
] as const;

// ─── Dropdown item ──────────────────────────────────────
function DropdownItem({
  href,
  onClick,
  icon,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 16px", fontSize: 14, fontWeight: 500,
    color: INK, textDecoration: "none", cursor: "pointer",
    background: "none", border: "none", width: "100%", textAlign: "left",
  };
  const [hovered, setHovered] = useState(false);
  const hoverStyle = hovered ? { background: "#F8FAFC" } : {};

  if (href) {
    return (
      <Link href={href} style={{ ...style, ...hoverStyle }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onClick={onClick}
      >
        {icon}{children}
      </Link>
    );
  }
  return (
    <button style={{ ...style, ...hoverStyle }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {icon}{children}
    </button>
  );
}

// ─── Icons ──────────────────────────────────────────────
const IconUser = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
  </svg>
);
const IconBookmark = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
  </svg>
);
const IconLogout = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);
const IconMenu = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const IconX = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ─── Main component ──────────────────────────────────────
export function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [owUser, setOwUser] = useState<{ name: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("ow_users")
          .select("name")
          .eq("auth_id", user.id)
          .maybeSingle();
        setOwUser(data);
      }
      setReady(true);
    }
    init();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [dropdownOpen]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    window.location.href = "/";
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const displayName = owUser?.name ?? user?.email?.split("@")[0] ?? "ユーザー";

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${LINE}`,
      }}>
        <div
          style={{ maxWidth: 1280, margin: "0 auto", height: 64 }}
          className="flex items-center gap-10 px-5 md:px-12"
        >
          {/* Logo */}
          <Link href="/" style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 700, fontSize: 22,
            color: ROYAL, letterSpacing: "-0.02em",
            textDecoration: "none", flexShrink: 0,
          }}>
            Opinio
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex flex-1" style={{ gap: 28 }}>
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  color: isActive(href) ? ROYAL : INK_SOFT,
                  fontSize: 14, fontWeight: 500,
                  textDecoration: "none",
                  borderBottom: isActive(href) ? `2px solid ${ROYAL}` : "2px solid transparent",
                  paddingBottom: 2,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => { if (!isActive(href)) e.currentTarget.style.color = ROYAL; }}
                onMouseLeave={(e) => { if (!isActive(href)) e.currentTarget.style.color = INK_SOFT; }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center flex-shrink-0" style={{ gap: 12 }}>
            {!ready ? (
              // Skeleton placeholder to avoid layout shift
              <div style={{ width: 120, height: 36 }} />
            ) : user ? (
              // ─── Logged in ───
              <div className="relative" ref={dropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
                    borderRadius: 8,
                  }}
                  aria-label="プロフィールメニュー"
                >
                  <Avatar name={displayName} size="sm" gradient="royal" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{displayName}</span>
                  <svg width="14" height="14" fill="none" stroke={INK_SOFT} viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 8px)",
                    minWidth: 200,
                    background: "#fff",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
                    overflow: "hidden",
                    zIndex: 200,
                  }}>
                    <DropdownItem href="/mypage" icon={<IconUser />} onClick={() => setDropdownOpen(false)}>
                      マイページ
                    </DropdownItem>
                    <DropdownItem href="/mypage/bookmarks" icon={<IconBookmark />} onClick={() => setDropdownOpen(false)}>
                      お気に入り
                    </DropdownItem>
                    <div style={{ borderTop: `1px solid ${LINE}`, margin: "4px 0" }} />
                    <DropdownItem icon={<IconLogout />} onClick={handleLogout}>
                      ログアウト
                    </DropdownItem>
                  </div>
                )}
              </div>
            ) : (
              // ─── Not logged in ───
              <>
                <Link
                  href="/for-companies"
                  style={{ fontSize: 13, fontWeight: 500, color: INK_SOFT, textDecoration: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = INK; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = INK_SOFT; }}
                >
                  採用担当者の方
                </Link>
                <Link
                  href="/auth?mode=login"
                  style={{ fontSize: 14, fontWeight: 500, color: INK, textDecoration: "none", padding: "8px 16px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = ROYAL; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = INK; }}
                >
                  ログイン
                </Link>
                <Link
                  href="/auth"
                  style={{
                    fontSize: 14, fontWeight: 600, color: "#fff",
                    background: ROYAL,
                    padding: "10px 20px", borderRadius: 8,
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(0,35,102,0.25)",
                    transition: "background 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#001A4D"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ROYAL; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  無料登録
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", color: INK, padding: 4 }}
            className="flex md:hidden"
            aria-label="メニュー"
          >
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div style={{ borderTop: `1px solid ${LINE}`, background: "#fff" }} className="mobile-menu">
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
              {NAV_ITEMS.map(({ href, label }) => (
                <Link key={href} href={href} style={{
                  color: isActive(href) ? ROYAL : INK,
                  fontSize: 15, fontWeight: 500,
                  textDecoration: "none",
                  padding: "10px 0",
                  borderBottom: `1px solid ${LINE}`,
                }}>
                  {label}
                </Link>
              ))}

              <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {user ? (
                  <>
                    <Link href="/mypage" style={{ fontSize: 14, fontWeight: 500, color: INK, textDecoration: "none", padding: "8px 0" }}>
                      マイページ
                    </Link>
                    <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, color: INK, textAlign: "left", padding: "8px 0" }}>
                      ログアウト
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/auth?mode=login" style={{ fontSize: 14, fontWeight: 500, color: INK, textDecoration: "none", padding: "8px 0" }}>
                      ログイン
                    </Link>
                    <Link href="/auth" style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: ROYAL, padding: "12px 20px", borderRadius: 8, textDecoration: "none", textAlign: "center" }}>
                      無料登録
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

    </>
  );
}
