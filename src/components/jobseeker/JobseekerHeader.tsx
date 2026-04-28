"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/companies", label: "企業を見る" },
  { href: "/jobs", label: "求人を探す" },
  { href: "/mentors", label: "メンター" },
  { href: "/articles", label: "記事" },
];

export function JobseekerHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email ?? "" } : null);
      setLoading(false);
    });
  }, []);

  const initial = user?.email?.charAt(0).toUpperCase() ?? "";

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
        maxWidth: 1200,
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
              <Link href="/mypage" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #002366, #3B5FD9)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {initial}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)" }}>
                  マイページ
                </span>
              </Link>
            ) : (
              <>
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
