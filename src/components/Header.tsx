"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, LayoutGrid, LogOut, Menu, X, Building2, ShieldCheck, ArrowRight } from "lucide-react";

// ─── Badge Component ────────────────────────────────

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [newJobCount, setNewJobCount] = useState<number>(0);
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
              .in("status", ["published", "active"])
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
  const isAdminUser = roles.includes("admin");
  const hasBothRoles = isCompany && isCandidate;
  const isCompanyOnly = isCompany && !isCandidate;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function navStyle(href: string): React.CSSProperties {
    return isActive(href)
      ? { fontSize: 15, fontWeight: 600, color: "var(--royal)", borderBottom: "2px solid var(--royal)", paddingBottom: 2 }
      : { fontSize: 15, fontWeight: 600, color: "#0f172a" };
  }

  function mobileNavStyle(href: string): React.CSSProperties {
    return isActive(href)
      ? { fontSize: 15, fontWeight: 600, color: "var(--royal)" }
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

  // ─── 求職者ナビ（3項目：求人 / 企業 / 記事）──────────
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
          <Link href="/articles" className="block" style={mobileNavStyle("/articles")} onClick={close}>
            記事
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
          onMouseEnter={(e) => { if (!isActive("/jobs")) e.currentTarget.style.color = "var(--royal)"; }}
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
          onMouseEnter={(e) => { if (!isActive("/companies")) e.currentTarget.style.color = "var(--royal)"; }}
          onMouseLeave={(e) => { if (!isActive("/companies")) e.currentTarget.style.color = "#0f172a"; }}
        >
          企業を知る
        </Link>
        <Link
          href="/articles"
          className="transition-colors"
          style={navStyle("/articles")}
          onMouseEnter={(e) => { if (!isActive("/articles")) e.currentTarget.style.color = "var(--royal)"; }}
          onMouseLeave={(e) => { if (!isActive("/articles")) e.currentTarget.style.color = "#0f172a"; }}
        >
          記事
        </Link>
      </>
    );
  }

  // 企業担当者専用ナビ
  function renderCompanyNav(mobile: boolean) {
    const sty = mobile ? mobileNavStyle : navStyle;
    const close = mobile ? () => setMenuOpen(false) : undefined;

    const hoverHandlers = (href: string) => mobile ? {} : {
      onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => { if (!isActive(href)) e.currentTarget.style.color = "var(--royal)"; },
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
            href="/business"
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
            className="transition-colors flex items-center gap-1.5"
            style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, var(--royal), #3B5FD9)", padding: "9px 18px", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,35,102,0.25)" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,35,102,0.35)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,35,102,0.25)"; e.currentTarget.style.transform = "none"; }}
          >
            無料で始める
            <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </>
      );
    }

    // ログイン済み → プロフィールアイコン + ドロップダウン
    return (
      <div className="relative" ref={profileDropdownRef}>
        <button
          type="button"
          onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--royal-50)", color: "var(--royal)",
            border: profileDropdownOpen ? "2px solid var(--royal)" : "2px solid transparent",
          }}
          aria-label="プロフィールメニュー"
        >
          {/* User icon */}
          <User size={18} strokeWidth={2} />
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
                href="/mypage"
                className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors"
                style={{ color: "#374151", fontWeight: 500 }}
                onClick={() => setProfileDropdownOpen(false)}
              >
                <LayoutGrid size={16} strokeWidth={1.5} />
                マイページ
              </Link>

              {/* モード切替: 採用担当モード */}
              {isCompany && (
                <>
                  <div style={{ borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
                  <Link
                    href="/biz/dashboard"
                    className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors"
                    style={{ color: "#374151", fontWeight: 500 }}
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <Building2 size={16} strokeWidth={1.5} />
                    採用担当として利用
                  </Link>
                </>
              )}

              {/* モード切替: 運営モード（admin のみ） */}
              {isAdminUser && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors"
                  style={{ color: "#374151", fontWeight: 500 }}
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <ShieldCheck size={16} strokeWidth={1.5} />
                  運営管理画面
                </Link>
              )}

              <div style={{ borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors text-left"
                style={{ color: "#374151", fontWeight: 500 }}
              >
                <LogOut size={16} strokeWidth={1.5} />
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
            style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--royal)", padding: "8px 20px", borderRadius: 8 }}
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
          href="/mypage"
          className="block"
          style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
          onClick={() => setMenuOpen(false)}
        >
          マイページ
        </Link>
        <button
          type="button"
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
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: 64 }}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--royal,var(--royal))", letterSpacing: "-0.5px", fontFamily: "'Inter', sans-serif" }}>
              OPINIO
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
              padding: "2px 6px", borderRadius: 3,
              background: "var(--royal,var(--royal))", color: "#fff",
              textTransform: "uppercase",
              display: "inline-block",
            }}>
              for career
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
                  className="transition-colors flex items-center gap-1.5"
                  style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, var(--royal), #3B5FD9)", padding: "9px 18px", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,35,102,0.25)" }}
                >
                  無料で始める
                </Link>
              </>
            ) : (
              getDesktopAuth()
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            {menuOpen ? (
              <X size={24} strokeWidth={2} />
            ) : (
              <Menu size={24} strokeWidth={2} />
            )}
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
