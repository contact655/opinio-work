"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { CompanySwitcher } from "./CompanySwitcher";
import type { TenantCompany } from "@/lib/business/dashboard";

type BusinessLayoutVariant = "default" | "fullBleed";

type Props = {
  userName: string;
  tenantName?: string;
  tenantLogoGradient?: string | null;
  tenantLogoLetter?: string | null;
  planType?: string | null;
  variant?: BusinessLayoutVariant;
  children: React.ReactNode;
  memberships?: TenantCompany[];
  currentTenantId?: string;
};

const NAV_ITEMS = [
  {
    href: "/biz/dashboard",
    label: "ダッシュボード",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: "/biz/company",
    label: "企業情報",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>
      </svg>
    ),
  },
  {
    href: "/biz/jobs",
    label: "求人管理",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
      </svg>
    ),
  },
  {
    href: "/biz/meetings",
    label: "カジュアル面談",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: "/biz/applications",
    label: "応募管理",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    href: "/biz/members",
    label: "チーム管理",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

function PlanPill({ planType }: { planType?: string | null }) {
  if (!planType) {
    return (
      <span style={{
        padding: "2px 8px", borderRadius: 100,
        fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 700,
        letterSpacing: "0.1em",
        background: "var(--line-soft)", color: "var(--ink-soft)",
        border: "1px solid var(--line)",
        marginLeft: 6,
      }}>FREE</span>
    );
  }
  const labelMap: Record<string, string> = {
    performance: "成果報酬",
    saas_monthly: "SaaS月額",
    saas_yearly: "SaaS年額",
  };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 100,
      fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.1em",
      background: "linear-gradient(135deg, var(--gold), #B45309)",
      color: "#fff",
      marginLeft: 6,
    }}>
      {labelMap[planType] ?? "有料"}
    </span>
  );
}

export function BusinessLayout({
  userName,
  tenantName,
  tenantLogoGradient,
  tenantLogoLetter,
  planType,
  variant = "default",
  children,
  memberships,
  currentTenantId,
}: Props) {
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

  const userInitial = (userName || "?").trim().charAt(0).toUpperCase();
  const logoLetter = tenantLogoLetter || (tenantName || "?").trim().charAt(0).toUpperCase();
  const logoGradient = tenantLogoGradient || "linear-gradient(135deg, #F97316, #EA580C)";

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
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-tint)",
      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* ── Topbar ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
        padding: "12px 28px",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}>
        {/* Brand */}
        <Link href="/biz/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700, fontSize: 20,
            color: "var(--royal)",
            letterSpacing: "-0.02em",
          }}>Opinio</span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9, fontWeight: 700,
            letterSpacing: "0.15em",
            padding: "2px 7px",
            background: "var(--royal)", color: "#fff",
            borderRadius: 3,
            textTransform: "uppercase",
          }}>Business</span>
        </Link>

        {/* Company identifier / switcher */}
        {tenantName && (
          memberships && currentTenantId ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CompanySwitcher
                currentCompany={{ id: currentTenantId, name: tenantName, logoGradient: tenantLogoGradient, logoLetter: tenantLogoLetter }}
                memberships={memberships}
              />
              <PlanPill planType={planType} />
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              paddingLeft: 20,
              borderLeft: "1px solid var(--line)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: logoGradient,
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13,
                flexShrink: 0,
              }}>
                {logoLetter}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {tenantName}
              </span>
              <PlanPill planType={planType} />
            </div>
          )
        )}

        <div style={{ flex: 1 }} />

        {/* User menu */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            aria-label="アカウントメニュー"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", padding: "6px 12px 6px 6px",
              borderRadius: 100, border: "none", background: "transparent",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--royal), var(--accent))",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 12,
            }}>
              {userInitial}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
                {userName}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400 }}>Admin</div>
            </div>
          </button>

          {avatarOpen && (
            <div style={{
              position: "absolute", right: 0, top: 48,
              minWidth: 200, background: "#fff",
              borderRadius: 10,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
              overflow: "hidden", zIndex: 200,
            }}>
              <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--line-soft)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{userName}</div>
                {tenantName && <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>{tenantName}</div>}
              </div>
              <Link
                href="/biz/company"
                onClick={() => setAvatarOpen(false)}
                style={{
                  display: "block", padding: "10px 16px",
                  fontSize: 13, color: "var(--ink-soft)", fontWeight: 500,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                企業情報を編集
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 16px", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500,
                  background: "transparent", border: "none", cursor: "pointer",
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
      </header>

      {/* ── Body: sidebar + main ── */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "calc(100vh - 57px)" }}>

        {/* Sidebar */}
        <aside style={{
          background: "#fff",
          borderRight: "1px solid var(--line)",
          padding: "20px 0",
          position: "sticky",
          top: 57,
          alignSelf: "start",
          height: "calc(100vh - 57px)",
          overflowY: "auto",
        }}>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
            letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "0 20px 8px",
          }}>
            採用活動
          </div>

          <nav>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 20px",
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? "var(--royal)" : "var(--ink-soft)",
                    textDecoration: "none",
                    borderLeft: `3px solid ${active ? "var(--royal)" : "transparent"}`,
                    background: active ? "var(--royal-50)" : "transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)";
                      (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)";
                    }
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: active ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Plan widget */}
          <div style={{ margin: "20px 16px 0" }}>
            {planType ? (
              <div style={{
                padding: 14, borderRadius: 10, textAlign: "center",
                background: "linear-gradient(135deg, var(--success-soft) 0%, #D1FAE5 100%)",
                border: "1px solid #A7F3D0",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>有料プラン利用中</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.6 }}>すべての機能が利用可能です</div>
              </div>
            ) : (
              <div style={{
                padding: 14, borderRadius: 10, textAlign: "center",
                background: "linear-gradient(135deg, var(--gold-soft) 0%, #FEF3C7 100%)",
                border: "1px solid #FDE68A",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>無料プラン</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 10 }}>
                  有料プランで求人掲載・候補者の可視化が可能に
                </div>
                <button style={{
                  padding: "6px 14px", width: "100%",
                  background: "var(--royal)", color: "#fff",
                  border: "none", borderRadius: 6,
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>
                  有料プランを見る
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main style={variant === "fullBleed"
          ? { padding: 0, minWidth: 0, overflow: "hidden" }
          : { padding: "28px 36px 60px", maxWidth: 1200, minWidth: 0 }
        }>
          {children}
        </main>
      </div>

      {/* Mobile fallback nav (≤768px) */}
      <style>{`
        @media (max-width: 768px) {
          .biz-layout-grid { grid-template-columns: 1fr !important; }
          .biz-layout-sidebar {
            position: static !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid var(--line) !important;
            padding: 12px 0 !important;
          }
          .biz-layout-sidebar nav { flex-direction: row; overflow-x: auto; }
          .biz-layout-main { padding: 20px 16px 48px !important; }
        }
      `}</style>
    </div>
  );
}
