"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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
  const [jobCount, setJobCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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
  const isCandidate = roles.includes("candidate");
  const hasBothRoles = isCompany && isCandidate;
  const isCompanyOnly = isCompany && !isCandidate;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function navClass(href: string) {
    return isActive(href)
      ? "text-sm text-primary font-semibold border-b-2 border-primary pb-0.5 transition-colors"
      : "text-sm text-gray-600 hover:text-foreground transition-colors";
  }

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

  // ─── 共通ナビリンク（求職者向け）─────────────────────
  // 企業を探す → キャリア相談 → 求人を見る → メッセージ → スカウト

  function renderCandidateNav(mobile: boolean) {
    const cls = mobile ? mobileNavClass : navClass;
    const close = mobile ? () => setMenuOpen(false) : undefined;
    return (
      <>
        <Link href="/companies" className={cls("/companies")} onClick={close}>
          企業を探す
        </Link>
        <Link href="/career-consultation" className={cls("/career-consultation")} onClick={close}>
          キャリア相談
        </Link>
        <Link href="/jobs" className={cls("/jobs")} onClick={close}>
          求人を見る
          {jobCount !== null && jobCount > 0 && (
            <NavBadge color="green">{jobCount}</NavBadge>
          )}
        </Link>
        <Link href="/messages" className={cls("/messages")} onClick={close}>
          メッセージ
          {unreadCount > 0 && (
            <NavBadge color="red">{unreadCount}</NavBadge>
          )}
        </Link>
        <Link href="/scout" className={cls("/scout")} onClick={close}>
          スカウト
        </Link>
      </>
    );
  }

  // 企業担当者専用ナビ
  function renderCompanyNav(mobile: boolean) {
    const cls = mobile ? mobileNavClass : navClass;
    const close = mobile ? () => setMenuOpen(false) : undefined;
    return (
      <>
        <Link href="/company/dashboard" className={cls("/company/dashboard")} onClick={close}>
          求人を管理する
        </Link>
        <Link href="/company/edit" className={cls("/company/edit")} onClick={close}>
          企業プロフィール
        </Link>
        <Link href="/company/jobs/new" className={cls("/company/jobs/new")} onClick={close}>
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

  // ─── Auth ボタン ────────────────────────────────────

  function getDesktopAuth() {
    if (!user) {
      return (
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
      );
    }

    return (
      <>
        {!isCompanyOnly && (
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
    );
  }

  function getMobileAuth() {
    if (!user) {
      return (
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
      );
    }

    return (
      <>
        {!isCompanyOnly && (
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
    );
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

          {/* Desktop Nav — checkingAuth中もデフォルトナビを表示（バッジのみ非表示） */}
          <nav className="hidden md:flex items-center gap-8">
            {getDesktopNav()}
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {checkingAuth ? (
              /* 認証チェック中はログイン/登録ボタンを表示 */
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
        <div className="md:hidden bg-white border-t border-card-border">
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
