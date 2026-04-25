"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Badge Component ────────────────────────────────
function NavBadge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "green" | "amber" | "red";
}) {
  const styles = {
    green: { background: "#E1F5EE", color: "#0F6E56" },
    amber: { background: "#FAEEDA", color: "#854F0B" },
    red: { background: "#E24B4A", color: "#fff" },
  };
  return (
    <span
      className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={styles[color]}
    >
      {children}
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [newJobCount, setNewJobCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        try {
          const res = await fetch("/api/roles");
          if (res.ok) {
            const data = await res.json();
            const fetchedRoles = data.roles || [];
            setRoles(fetchedRoles);
          }
        } catch (err) {
          console.error("[Header] roles fetch error:", err);
        }

        // 未読メッセージ数を取得
        try {
          const { count } = await supabase
            .from("ow_messages")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .neq("sender_id", user.id);
          if (count && count > 0) setUnreadCount(count);
        } catch {
          // ow_messages may not exist yet
        }

        // 前回ログイン以降の新着求人数を取得
        try {
          const { data: profile } = await supabase
            .from("ow_profiles")
            .select("last_login_at")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile?.last_login_at) {
            const { count: njCount } = await supabase
              .from("ow_jobs")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
              .gt("created_at", profile.last_login_at);
            if (njCount && njCount > 0) setNewJobCount(njCount);
          }
        } catch {
          // ignore
        }
      }

      setCheckingAuth(false);
    }
    checkAuth();
  }, []);

  // プロフィールドロップダウンを外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdownOpen]);

  const isCompany = roles.includes("company");
  const isCandidate = roles.includes("candidate");
  const hasBothRoles = isCompany && isCandidate;
  const isCompanyOnly = isCompany && !isCandidate;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function navStyle(href: string): React.CSSProperties {
    return isActive(href)
      ? { fontSize: 15, fontWeight: 600, color: "#059669", borderBottom: "2px solid #059669", paddingBottom: 2 }
      : { fontSize: 15, fontWeight: 600, color: "#0f172a" };
  }

  function mobileNavStyle(href: string): React.CSSProperties {
    return isActive(href)
      ? { fontSize: 15, fontWeight: 600, color: "#059669" }
      : { fontSize: 15, fontWeight: 600, color: "#0f172a" };
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setRoles([]);
    setProfileDropdownOpen(false);
    window.location.href = "/";
  }

  // ─── 求職者ナビ（3項目：求人を探す / 企業を知る / 無料相談）──────────
  function renderCandidateNav(mobile: boolean) {
    if (mobile) {
      const close = () => setMenuOpen(false);
      return (
        <>
          <Link href="/jobs" className="block" style={mobileNavStyle("/jobs")} onClick={close}>
            求人を探す
            {user && newJobCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 16, height: 16, borderRadius: "50%", background: "#e24b4a",
                color: "#fff", fontSize: 10, fontWeight: 700, marginLeft: 4,
              }}>
                {newJobCount > 99 ? "99" : newJobCount}
              </span>
            )}
          </Link>
          <Link href="/companies" className="block" style={mobileNavStyle("/companies")} onClick={close}>
            企業を知る
          </Link>
          <Link href="/career-consultation" className="block" style={mobileNavStyle("/career-consultation")} onClick={close}>
            メンターに相談
          </Link>
        </>
      );
    }

    // Desktop
    return (
      <>
        <Link
          href="/jobs"
          className="transition-colors"
          style={navStyle("/jobs")}
          onMouseEnter={(e) => { if (!isActive("/jobs")) e.currentTarget.style.color = "#059669"; }}
          onMouseLeave={(e) => { if (!isActive("/jobs")) e.currentTarget.style.color = "#0f172a"; }}
        >
          求人を探す
          {user && newJobCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 16, height: 16, borderRadius: "50%", background: "#e24b4a",
              color: "#fff", fontSize: 10, fontWeight: 700, marginLeft: 4,
            }}>
              {newJobCount > 99 ? "99" : newJobCount}
            </span>
          )}
        </Link>
        <Link
          href="/companies"
          className="transition-colors"
          style={navStyle("/companies")}
          onMouseEnter={(e) => { if (!isActive("/companies")) e.currentTarget.style.color = "#059669"; }}
          onMouseLeave={(e) => { if (!isActive("/companies")) e.currentTarget.style.color = "#0f172a"; }}
        >
          企業を知る
        </Link>
        <Link
          href="/career-consultation"
          className="transition-colors"
          style={navStyle("/career-consultation")}
          onMouseEnter={(e) => { if (!isActive("/career-consultation")) e.currentTarget.style.color = "#059669"; }}
          onMouseLeave={(e) => { if (!isActive("/career-consultation")) e.currentTarget.style.color = "#0f172a"; }}
        >
          メンターに相談
        </Link>
      </>
    );
  }

  // 企業担当者専用ナビ
  function renderCompanyNav(mobile: boolean) {
    const sty = mobile ? mobileNavStyle : navStyle;
    const close = mobile ? () => setMenuOpen(false) : undefined;

    const hoverHandlers = (href: string) => mobile ? {} : {
      onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => { if (!isActive(href)) e.currentTarget.style.color = "#059669"; },
      onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => { if (!isActive(href)) e.currentTarget.style.color = "#0f172a"; },
    };

    return (
      <>
        <Link href="/biz/dashboard" className={mobile ? "block" : "transition-colors"} style={sty("/biz/dashboard")} onClick={close} {...hoverHandlers("/biz/dashboard")}>
          求人を管理する
        </Link>
        <Link href="/biz/company" className={mobile ? "block" : "transition-colors"} style={sty("/biz/company")} onClick={close} {...hoverHandlers("/biz/company")}>
          企業プロフィール
        </Link>
        <Link href="/biz/jobs/new" className={mobile ? "block" : "transition-colors"} style={sty("/biz/jobs/new")} onClick={close} {...hoverHandlers("/biz/jobs/new")}>
          求人を作成
        </Link>
      </>
    );
  }

  function getDesktopNav() {
    if (!user) return renderCandidateNav(false);
    if (hasBothRoles) return renderCandidateNav(false);
    if (isCompanyOnly) return renderCompanyNav(false);
    return renderCandidateNav(false);
  }

  function getMobileNav() {
    if (!user) return renderCandidateNav(true);
    if (hasBothRoles) return renderCandidateNav(true);
    if (isCompanyOnly) return renderCompanyNav(true);
    return renderCandidateNav(true);
  }

  // ─── Auth セクション ────────────────────────────────────
  function getDesktopAuth() {
    if (!user) {
      return (
        <>
          <Link
            href="/for-companies"
            className="transition-colors"
            style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#0f172a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; }}
          >
            採用担当者の方
          </Link>
          <Link
            href="/auth/signin"
            className="transition-colors"
            style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#0f172a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#374151"; }}
          >
            ログイン
          </Link>
          <Link
            href="/auth/signup"
            className="transition-colors"
            style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "#059669", padding: "8px 20px", borderRadius: 8 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#047857"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#059669"; }}
          >
            無料登録
          </Link>
        </>
      );
    }

    // ログイン済み → プロフィールアイコン + ドロップダウン
    return (
      <div className="relative" ref={profileDropdownRef}>
        <button
          onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#E1F5EE", color: "#0F6E56",
            border: profileDropdownOpen ? "2px solid #059669" : "2px solid transparent",
          }}
          aria-label="プロフィールメニュー"
        >
          {/* User icon */}
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {/* 未読バッジ */}
          {unreadCount > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 16, height: 16, borderRadius: "50%",
              background: "#e24b4a", color: "#fff",
              fontSize: 9, fontWeight: 700,
              border: "2px solid #fff",
            }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* ドロップダウン */}
        {profileDropdownOpen && (
          <div
            className="absolute right-0 top-full mt-2"
            style={{ minWidth: 180 }}
          >
            <div
              className="bg-white rounded-lg py-1.5 overflow-hidden"
              style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)" }}
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors"
                style={{ color: "#374151", fontWeight: 500 }}
                onClick={() => setProfileDropdownOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                マイページ
              </Link>
              <Link
                href="/messages"
                className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors"
                style={{ color: "#374151", fontWeight: 500 }}
                onClick={() => setProfileDropdownOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                メッセージ
                {unreadCount > 0 && (
                  <NavBadge color="red">{unreadCount}</NavBadge>
                )}
              </Link>
              <div style={{ borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors text-left"
                style={{ color: "#374151", fontWeight: 500 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function getMobileAuth() {
    if (!user) {
      return (
        <>
          <Link
            href="/auth/signin"
            className="block"
            style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
            onClick={() => setMenuOpen(false)}
          >
            ログイン
          </Link>
          <Link
            href="/auth/signup"
            className="block text-center"
            style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "#059669", padding: "8px 20px", borderRadius: 8 }}
            onClick={() => setMenuOpen(false)}
          >
            無料登録
          </Link>
        </>
      );
    }

    return (
      <>
        <Link
          href="/dashboard"
          className="block"
          style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
          onClick={() => setMenuOpen(false)}
        >
          マイページ
        </Link>
        <Link
          href="/messages"
          className="block"
          style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
          onClick={() => setMenuOpen(false)}
        >
          メッセージ
          {unreadCount > 0 && (
            <NavBadge color="red">{unreadCount}</NavBadge>
          )}
        </Link>
        <button
          onClick={() => {
            setMenuOpen(false);
            handleLogout();
          }}
          className="block"
          style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
        >
          ログアウト
        </button>
      </>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white backdrop-blur-sm" style={{ borderBottom: "1px solid #e2e8f0" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: 64 }}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
              Opinio
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {getDesktopNav()}
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {checkingAuth ? (
              <>
                <Link
                  href="/auth/signin"
                  className="transition-colors"
                  style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
                >
                  ログイン
                </Link>
                <Link
                  href="/auth/signup"
                  className="transition-colors"
                  style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "#059669", padding: "8px 20px", borderRadius: 8 }}
                >
                  無料登録
                </Link>
              </>
            ) : (
              getDesktopAuth()
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white" style={{ borderTop: "1px solid #e2e8f0" }}>
          <div className="px-4 py-4 space-y-3">
            {getMobileNav()}
            <hr className="border-card-border" />
            {getMobileAuth()}
          </div>
        </div>
      )}
    </header>
  );
}
