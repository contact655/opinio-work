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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        const authUser = session?.user;
        if (!authUser) return;
        // Fetch display name from ow_users for initial
        const { data: owUser } = await supabase
          .from("ow_users")
          .select("name")
          .eq("auth_id", authUser.id)
          .maybeSingle();

        setUser({
          email: authUser.email ?? "",
          name: owUser?.name ?? authUser.email?.split("@")[0] ?? "",
        });
      })
      .catch(() => {
        // getSession 失敗時も loading を解除してボタンを表示する
      })
      .finally(() => {
        setLoading(false);
      });
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
        padding: "0 48px",
        height: 60,
        display: "flex",
        alignItems: "center",
        gap: 40,
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
            Opinio
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 28, flex: 1 }}>
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
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Auth actions */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
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
                  {/* Avatar circle — InitialAvatar 共通コンポーネント使用 */}
                  <InitialAvatar name={user.name || user.email} size={32} />
                  {/* Chevron */}
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

                {/* Dropdown */}
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
                    {/* Header: name + email */}
                    <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--line-soft)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                        {user.email}
                      </div>
                    </div>
                    {/* マイページ */}
                    <Link
                      href="/mypage"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "block",
                        padding: "10px 16px",
                        fontSize: 13,
                        color: "var(--ink-soft)",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                    >
                      マイページ
                    </Link>
                    {/* ログアウト */}
                    <button
                      onClick={handleLogout}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 16px",
                        fontSize: 13,
                        color: "var(--ink-soft)",
                        fontWeight: 500,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        borderTop: "0.5px solid var(--line-soft)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      ログアウト
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Logged-out: ログイン + 無料登録 ── */
              <>
                <Link
                  href="/for-companies"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ink-mute)",
                    textDecoration: "none",
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                  }}
                >
                  採用担当の方はこちら →
                </Link>
                <Link
                  href="/auth"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-soft)",
                    textDecoration: "none",
                    padding: "8px 14px",
                  }}
                >
                  ログイン
                </Link>
                <Link
                  href="/auth?mode=signup"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#fff",
                    background: "var(--royal)",
                    textDecoration: "none",
                    padding: "8px 18px",
                    borderRadius: 8,
                  }}
                >
                  無料登録
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
