"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import { InitialAvatar } from "@/components/ui/InitialAvatar";

const NAV_LINKS = [
  { href: "/companies", label: "企業を見る" },
  { href: "/jobs", label: "求人を探す" },
  { href: "/mentors", label: "メンター" },
  { href: "/articles", label: "記事" },
  { href: "/posts",    label: "発信" },
];

export function JobseekerHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true; // アンマウント後の setState 防止（二重発火・競合ガード）

    async function resolveUser(authUser: { id: string; email?: string } | null | undefined) {
      if (!authUser) {
        if (active) setUser(null);
        return;
      }
      const { data: owUser } = await supabase
        .from("ow_users")
        .select("name")
        .eq("auth_id", authUser.id)
        .maybeSingle();

      if (!active) return;
      setUser({
        email: authUser.email ?? "",
        name: owUser?.name ?? authUser.email?.split("@")[0] ?? "",
      });
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => resolveUser(session?.user))
      .catch(() => {
        // getSession 失敗時も loading を解除してボタンを表示する
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        resolveUser(session?.user);
        if (active) setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Click-outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Close mobile menu on pathname change or Escape key
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileMenuOpen(false); }
    if (mobileMenuOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Use first character of name (first word, first char), fallback to email
  // _initial: retained for future use (InitialAvatar accepts name prop directly)
  const _initial = user?.name
    ? user.name.trim().charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() ?? "";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setUser(null);
    window.location.href = "/";
  }

  return (
    <>
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          maxWidth: "var(--max-w-page)",
          margin: "0 auto",
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 22,
              color: "var(--royal)",
              letterSpacing: "-0.02em",
            }}>
              OPINIO
            </span>
          </Link>

          {/* Nav — desktop only */}
          <nav className="hidden md:flex" style={{ gap: 24, flex: 1 }}>
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: active ? "var(--royal)" : "var(--ink-soft)",
                    textDecoration: "none",
                    borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
                    paddingBottom: 2,
                    transition: "color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Spacer — mobile */}
          <div className="flex md:hidden" style={{ flex: 1 }} />

          {/* Auth actions — desktop */}
          <div className="hidden md:flex" style={{ gap: 10, alignItems: "center", flexShrink: 0 }}>
            {!loading && (
              user ? (
                /* ── Logged-in: avatar button + dropdown ── */
                <div style={{ position: "relative" }} ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-label="アカウントメニュー"
                    aria-expanded={dropdownOpen}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      padding: "4px 8px 4px 4px",
                      borderRadius: 100,
                      border: "none",
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <InitialAvatar name={user.name || user.email} size={32} />
                    <ChevronDown
                      size={14}
                      style={{
                        color: "var(--ink-mute)",
                        transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {dropdownOpen && (
                    <div style={{
                      position: "absolute",
                      right: 0,
                      top: 46,
                      minWidth: 190,
                      background: "#fff",
                      borderRadius: 10,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
                      overflow: "hidden",
                      zIndex: 200,
                    }}>
                      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{user.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{user.email}</div>
                      </div>
                      <Link
                        href="/mypage"
                        onClick={() => setDropdownOpen(false)}
                        style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, textDecoration: "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                      >
                        マイページ
                      </Link>
                      <button
                        onClick={handleLogout}
                        style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, background: "transparent", border: "none", cursor: "pointer", borderTop: "0.5px solid var(--line-soft)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        ログアウト
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link href="/business" style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", textDecoration: "none", padding: "8px 10px", whiteSpace: "nowrap" }}>
                    企業の方へ →
                  </Link>
                  <Link href="/auth" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", textDecoration: "none", padding: "8px 14px" }}>
                    ログイン
                  </Link>
                  <Link href="/auth?mode=signup" style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--royal)", textDecoration: "none", padding: "8px 18px", borderRadius: 8 }}>
                    無料登録
                  </Link>
                </>
              )
            )}
          </div>

          {/* Mobile: avatar (if logged in) + hamburger */}
          <div className="flex md:hidden" style={{ alignItems: "center", gap: 10, flexShrink: 0 }}>
            {!loading && user && (
              <InitialAvatar name={user.name || user.email} size={30} />
            )}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
              aria-expanded={mobileMenuOpen}
              style={{
                width: 36, height: 36,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8,
              }}
            >
              <span style={{
                display: "block", width: 20, height: 1.5, background: "var(--ink-soft)", borderRadius: 2,
                transform: mobileMenuOpen ? "translateY(6.5px) rotate(45deg)" : "none",
                transition: "transform 0.2s",
              }} />
              <span style={{
                display: "block", width: 20, height: 1.5, background: "var(--ink-soft)", borderRadius: 2,
                opacity: mobileMenuOpen ? 0 : 1,
                transition: "opacity 0.15s",
              }} />
              <span style={{
                display: "block", width: 20, height: 1.5, background: "var(--ink-soft)", borderRadius: 2,
                transform: mobileMenuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none",
                transition: "transform 0.2s",
              }} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 99,
            background: "rgba(0,0,0,0.25)",
          }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className="md:hidden"
        style={{
          position: "fixed", top: 60, right: 0, bottom: 0, zIndex: 100,
          width: 280, maxWidth: "90vw",
          background: "#fff",
          borderLeft: "1px solid var(--line)",
          overflowY: "auto",
          transform: mobileMenuOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* User info (if logged in) */}
        {!loading && user && (
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <InitialAvatar name={user.name || user.email} size={40} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{user.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{user.email}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav style={{ padding: "8px 0", flex: 1 }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: "block",
                  padding: "14px 24px",
                  fontSize: 15,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--royal)" : "var(--ink)",
                  textDecoration: "none",
                  borderLeft: active ? "3px solid var(--royal)" : "3px solid transparent",
                  background: active ? "var(--royal-50)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {label}
              </Link>
            );
          })}

          {/* Logged-in extras */}
          {!loading && user && (
            <>
              <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
              <Link
                href="/mypage"
                onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", padding: "14px 24px", fontSize: 15, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
              >
                マイページ
              </Link>
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                style={{ width: "100%", textAlign: "left", display: "block", padding: "14px 24px", fontSize: 15, fontWeight: 500, color: "var(--ink-soft)", background: "none", border: "none", cursor: "pointer" }}
              >
                ログアウト
              </button>
            </>
          )}

          {/* Logged-out: login + signup */}
          {!loading && !user && (
            <>
              <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", padding: "14px 24px", fontSize: 15, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
              >
                ログイン
              </Link>
              <div style={{ padding: "12px 20px 16px" }}>
                <Link
                  href="/auth?mode=signup"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: "block", padding: "13px 20px", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--royal)", borderRadius: 10, textDecoration: "none", textAlign: "center" }}
                >
                  無料登録
                </Link>
              </div>
              <Link
                href="/business"
                onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", padding: "12px 24px", fontSize: 13, color: "var(--ink-mute)", textDecoration: "none" }}
              >
                企業の方へ →
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
