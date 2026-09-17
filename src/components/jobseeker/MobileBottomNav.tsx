"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsLoggedIn } from "@/lib/auth/useIsLoggedIn";

/**
 * ⚠️★`authOnly` は「**未ログインで押すとログイン画面に飛ばされる**」という意味。
 *    見た目の好みではなく、`src/middleware.ts` の `needsAuth` と1対1にすること。
 *
 * 実測（2026-09-17 / 本番・未ログイン）:
 *   /companies 200 ／ /jobs 200 ／ /feed 200
 *   ★/people 307 → /auth?next=%2Fpeople ／ ★/mypage も `needsAuth` に入っている
 *
 * ⚠️★**未ログインでは3タブになる。** それでよい ——押しても入れないタブを
 *    2つ並べるより、入れるものだけを出す。
 *    ⚠️ 入口が消えるわけではない。ヘッダーに「ログイン」「無料登録」が出る。
 * ⚠️ `/feed` は未ログインでも中身が出る（飛ばされない）。**authOnly にしないこと。**
 */
const TABS: { href: string; label: string; authOnly?: boolean; icon: (active: boolean) => React.ReactNode }[] = [
  {
    href: "/companies",
    label: "企業",
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/jobs",
    label: "募集",
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    href: "/feed",
    label: "フィード",
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18M3 6h18M3 18h12" stroke={active ? "var(--royal)" : "currentColor"}/>
      </svg>
    ),
  },
  {
    href: "/people",
    label: "ユーザー",
    authOnly: true,
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill={active ? "currentColor" : "none"}/>
        <circle cx="9" cy="7" r="4" fill={active ? "currentColor" : "none"}/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "マイページ",
    authOnly: true,
    icon: (active: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  /* ⚠️ 判定は `useIsLoggedIn` の1箇所。**ここに getSession を書かないこと。**
        ヘッダーのナビ・`AuthAwareCta` と同じフックを使う。 */
  const login = useIsLoggedIn();

  // biz・admin・profile・onboarding ページでは非表示
  if (
    pathname.startsWith("/biz") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/profile")
  ) {
    return null;
  }

  return (
    // mobile-bottom-nav-root クラスで globals.css + Tailwind の両方から制御
    <div className="mobile-bottom-nav-root md:hidden">
      {/* ボトムナビの高さ分のスペーサー（コンテンツが隠れないように） */}
      <div style={{ height: 64 }} aria-hidden />

      <nav
        aria-label="メインナビゲーション"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "#fff",
          borderTop: "1px solid var(--line)",
          display: "flex",
          height: 64,
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        {/* ★未ログインには authOnly のタブを出さない（2026-09-17）。
               ⚠️★**判定前（loading）も出さない側に倒す。** 先に出して消すと
                  ちらつく（出てから消える）。`AuthAwareCta` と同じ倒し方。
               ⚠️ タブ数が変わるので `flex: 1` のまま（固定幅にしないこと）。 */}
        {TABS.filter((t) => !t.authOnly || login === "member").map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                textDecoration: "none",
                color: active ? "var(--royal)" : "var(--ink-mute)",
                // 12px未満のテキストを作らない方針（2026-08-03）。9px は読めない小ささだった。
                // 5タブ × 375px でも「マイページ」が折り返さないことを実機で確認済み。
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
                transition: "color 0.15s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {tab.icon(active)}
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
