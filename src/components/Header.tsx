"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [jobCount, setJobCount] = useState<number | null>(null);

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
            setRoles(data.roles || []);
          }
        } catch (err) {
          console.error("[Header] roles fetch error:", err);
        }
      }

      setCheckingAuth(false);
    }
    checkAuth();

    // 求人数を取得
    async function fetchJobCount() {
      try {
        const res = await fetch("/api/jobs/count");
        if (res.ok) {
          const data = await res.json();
          setJobCount(data.count);
        }
      } catch (err) {
        console.error("[Header] job count fetch error:", err);
      }
    }
    fetchJobCount();
  }, []);

  const isCompany = roles.includes("company");

  /** 現在のパスがhrefと一致するかを判定 */
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  /** ナビリンクのクラスを返す */
  function navClass(href: string) {
    return isActive(href)
      ? "text-sm text-primary font-semibold border-b-2 border-primary pb-0.5 transition-colors"
      : "text-sm text-gray-600 hover:text-foreground transition-colors";
  }

  /** モバイルナビリンクのクラスを返す */
  function mobileNavClass(href: string) {
    return isActive(href)
      ? "block text-sm text-primary font-semibold"
      : "block text-sm text-gray-600";
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setRoles([]);
    window.location.href = "/";
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">
              opinio<span className="text-primary">.work</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {checkingAuth ? (
              <div className="w-48 h-5" />
            ) : user && isCompany ? (
              <>
                <Link href="/company/dashboard" className={navClass("/company/dashboard")}>
                  求人を管理する
                </Link>
                <Link href="/company/edit" className={navClass("/company/edit")}>
                  企業プロフィール
                </Link>
                <Link href="/company/jobs/new" className={navClass("/company/jobs/new")}>
                  求人を作成
                </Link>
              </>
            ) : (
              <>
                <Link href="/companies" className={navClass("/companies")}>
                  企業を探す
                </Link>
                <Link href="/jobs" className={navClass("/jobs")}>
                  求人を見る{jobCount !== null && jobCount > 0 && (
                    <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {jobCount}
                    </span>
                  )}
                </Link>
                <Link href="/scout" className={navClass("/scout")}>
                  スカウト
                </Link>
              </>
            )}
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {checkingAuth ? (
              <div className="w-20 h-8" />
            ) : user ? (
              <>
                {!isCompany && (
                  <Link
                    href="/dashboard"
                    className="text-sm text-gray-600 hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    マイページ
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm text-gray-600 hover:text-foreground transition-colors"
                >
                  ログイン
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm bg-primary text-white px-4 py-2 rounded-full hover:bg-primary-dark transition-colors"
                >
                  無料登録
                </Link>
              </>
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
        <div className="md:hidden bg-white border-t border-card-border">
          <div className="px-4 py-4 space-y-3">
            {user && isCompany ? (
              <>
                <Link href="/company/dashboard" className={mobileNavClass("/company/dashboard")} onClick={() => setMenuOpen(false)}>
                  求人を管理する
                </Link>
                <Link href="/company/edit" className={mobileNavClass("/company/edit")} onClick={() => setMenuOpen(false)}>
                  企業プロフィール
                </Link>
                <Link href="/company/jobs/new" className={mobileNavClass("/company/jobs/new")} onClick={() => setMenuOpen(false)}>
                  求人を作成
                </Link>
              </>
            ) : (
              <>
                <Link href="/companies" className={mobileNavClass("/companies")} onClick={() => setMenuOpen(false)}>
                  企業を探す
                </Link>
                <Link href="/jobs" className={mobileNavClass("/jobs")} onClick={() => setMenuOpen(false)}>
                  求人を見る{jobCount !== null && jobCount > 0 && (
                    <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {jobCount}
                    </span>
                  )}
                </Link>
                <Link href="/scout" className={mobileNavClass("/scout")} onClick={() => setMenuOpen(false)}>
                  スカウト
                </Link>
              </>
            )}
            <hr className="border-card-border" />
            {user ? (
              <>
                {!isCompany && (
                  <Link
                    href="/dashboard"
                    className="block text-sm text-gray-600 font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    マイページ
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="block text-sm text-red-500"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="block text-sm text-gray-600"
                  onClick={() => setMenuOpen(false)}
                >
                  ログイン
                </Link>
                <Link
                  href="/auth/signup"
                  className="block text-sm text-center bg-primary text-white px-4 py-2 rounded-full"
                  onClick={() => setMenuOpen(false)}
                >
                  無料登録
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
