"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userName: string;
  tenantName?: string;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { href: "/biz/dashboard", label: "ダッシュボード" },
  { href: "/biz/jobs", label: "求人" },
  { href: "/biz/meetings", label: "面談" },
  { href: "/biz/company", label: "企業情報" },
];

export function BusinessLayout({ userName, tenantName, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    if (avatarOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarOpen]);

  const initial = (userName || "?").trim().charAt(0).toUpperCase();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAvatarOpen(false);
    router.push("/biz/auth");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{
        background: "#fff",
        borderBottom: "0.5px solid #e5e7eb",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
            {/* Logo */}
            <Link href="/biz/dashboard" style={{ display: "flex", alignItems: "baseline", gap: 6, textDecoration: "none" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>Opinio</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1D9E75", padding: "2px 8px", borderRadius: 6, background: "#E1F5EE" }}>Business</span>
            </Link>

            {/* Nav (desktop) */}
            <nav className="hidden md:flex" style={{ gap: 28 }}>
              {NAV_ITEMS.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  style={{
                    fontSize: 14,
                    fontWeight: isActive(n.href) ? 700 : 500,
                    color: isActive(n.href) ? "#0f172a" : "#6b7280",
                    textDecoration: "none",
                    paddingBottom: 2,
                    borderBottom: isActive(n.href) ? "2px solid #1D9E75" : "2px solid transparent",
                  }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            {/* Right: Bell + Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Notification bell (UI only, MVP) */}
              <button
                aria-label="通知"
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "transparent",
                  border: "0.5px solid #e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>

              {/* Avatar */}
              <div className="relative" ref={avatarRef}>
                <button
                  onClick={() => setAvatarOpen(!avatarOpen)}
                  aria-label="アカウントメニュー"
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "#0f172a", color: "#fff",
                    fontSize: 14, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", border: "none",
                  }}
                >
                  {initial}
                </button>
                {avatarOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: 44,
                    minWidth: 200, background: "#fff",
                    borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
                    overflow: "hidden",
                  }}>
                    <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{userName}</div>
                      {tenantName && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{tenantName}</div>}
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: "100%", textAlign: "left",
                        padding: "10px 16px", fontSize: 13, color: "#374151", fontWeight: 500,
                        background: "transparent", border: "none", cursor: "pointer",
                      }}
                    >
                      ログアウト
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile nav */}
          <div className="md:hidden" style={{ display: "flex", gap: 18, paddingBottom: 10, overflowX: "auto" }}>
            {NAV_ITEMS.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  fontSize: 13,
                  fontWeight: isActive(n.href) ? 700 : 500,
                  color: isActive(n.href) ? "#0f172a" : "#6b7280",
                  textDecoration: "none",
                  paddingBottom: 4,
                  borderBottom: isActive(n.href) ? "2px solid #1D9E75" : "2px solid transparent",
                  whiteSpace: "nowrap",
                }}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 24, paddingBottom: 48 }}>
        {children}
      </main>
    </div>
  );
}
