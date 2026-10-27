"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ⚠️★★**ログイン状態でタブを出し分けないこと**（2026-09-17 に入れて、同日に戻した）。
 *
 * `/people` と `/mypage` は未ログインだと **307 → /auth?next=…** なので、
 * 「押しても飛ばされるだけなら出さない」として一度**未ログインから隠し、3タブにした。**
 * ⇒ **同日に戻した**（柴さんの判断）。ヘッダーの `NAV_LINKS` と同じ理由で、
 *    **同じ画面の中に同じ行き先のリンクが残っており、外し方が中途半端**だった
 *    （`/feed` のサイドバーに マイページ / ブックマーク / フォロー中 / ユーザー一覧）。
 *
 * ⚠️★**もう一度隠す案を出すときは、本文側とまとめて判断すること。**
 *    タブだけ触ると同じ形に戻る。
 *
 * ── ★5つ目のタブだけ、ログイン状態でラベルと行き先を変える（2026-09-20 / 柴さんの指示）
 * ⚠️★**上の「出し分けないこと」に抵触しない。** あれが禁じているのは**タブを隠すこと**
 *    （5→3にして、同じ行き先のリンクが本文に残ったまま中途半端になった）。
 *    ここは**5タブのまま**で、5つ目の見え方だけが変わる。**タブ数を変えないこと。**
 *
 * なぜ要るか: 未ログインで「マイページ」を押すと `/auth?next=/mypage` へ飛ばされるが、
 * **ラベルからそれが読めない。** 新しく来た人には、押す前から「登録」だと分かるほうがよい。
 * ⚠️ 文言はヘッダーの登録ボタンと**同じ「無料登録」**にしてある（2026-09-20 に
 *    LP の3箇所もこれに揃えた）。**ここだけ別の語にしないこと。**
 *
 * ⚠️★**サーバーで判定しないこと。** レイアウトで cookie を読むと
 *    `(jobseeker)` 配下が丸ごと動的になり、`/companies/[id]` の ISR が壊れる。
 * ⚠️ 判定中（`null`）は**マイページのまま**出す。タブが空になる瞬間を作らない。
 */
const TABS = [
  /* ★「ホーム」を先頭に（2026-10-01 / 柴さんの指示。旧「フィード」）。
     ⚠️ ヘッダーのナビと同じ並び・同じ語にすること。片方だけ変えない。 */
  {
    /* ★★2026-10-27: `/home`（あなたの次の一手）。`/feed` は「フィード」として引き出しに置く */
    href: "/home",
    label: "ホーム",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18M3 6h18M3 18h12" stroke={active ? "var(--royal)" : "currentColor"}/>
      </svg>
    ),
  },
  {
    href: "/companies",
    label: "企業",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/jobs",
    label: "募集",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    href: "/people",
    label: "ユーザー",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill={active ? "currentColor" : "none"}/>
        <circle cx="9" cy="7" r="4" fill={active ? "currentColor" : "none"}/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "マイページ",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

/** 未ログインのときの5つ目。⚠️ 4つ目までは同じ（タブ数を変えない） */
const SIGNUP_TAB = {
  href: "/auth?mode=signup",
  label: "無料登録",
  icon: (active: boolean) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
};

/** タブバーの高さ（安全領域を除く）。⚠️ 引き出しの下端（JobseekerHeader）もこの値で止める */
export const BOTTOM_NAV_HEIGHT = 64;

/**
 * ★タブバーを出さないページ。⚠️ 引き出し（JobseekerHeader）も同じ関数で「タブバーが出ているか」を判定する。
 *    条件を書き写さないこと（割れると、タブバーが無いのに引き出しの下が空く／あるのに隠れる）
 */
export function isBottomNavHiddenOn(pathname: string): boolean {
  return ["/biz", "/admin", "/auth", "/onboarding", "/profile"].some((p) => pathname.startsWith(p));
}

export function MobileBottomNav() {
  const pathname = usePathname();
  /* null = 判定中。⚠️ 判定中はマイページのまま出す（下の `tabs`）。 */
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    /* ⚠️ `getUser()` ではなく `getSession()`。期限内ならネットワークに出ない
          （ヘッダーを 2026-08-13 に同じ理由で差し替えてある）。
       ⚠️ ここで求めているのは「ログインしているか」だけで、**署名の検証は要らない**。
          検証が要る判定は middleware が持っている。 */
    supabase.auth.getSession()
      .then(({ data }) => setLoggedIn(!!data.session?.user))
      .catch(() => setLoggedIn(null));   // ⚠️ 失敗時はマイページのまま（既定へ倒さない）
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ⚠️★**タブ数を変えない。** 5つ目を差し替えるだけ（冒頭の注記）。 */
  /* ★未ログインの「ホーム」は /feed（/home はログイン必須。2026-10-27） */
  const tabs = loggedIn === false
    ? [{ ...TABS[0], href: "/feed" }, ...TABS.slice(1, 4), SIGNUP_TAB]
    : TABS;

  // biz・admin・profile・onboarding ページでは非表示
  if (isBottomNavHiddenOn(pathname)) return null;

  return (
    // mobile-bottom-nav-root クラスで globals.css + Tailwind の両方から制御
    <div className="mobile-bottom-nav-root md:hidden">
      {/* ボトムナビの高さ分のスペーサー（コンテンツが隠れないように） */}
      <div style={{ height: BOTTOM_NAV_HEIGHT }} aria-hidden />

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
          height: BOTTOM_NAV_HEIGHT,
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        {/* ★バーの下の白い帯（2026-10-19）。iPhone の Safari で下のツールバーが縮むと、固定したバーが新しい下端まで
               下がらず、バーの下からページの中身が見えていた（実機のスクリーンショットで確認）。
               帯をバーと一緒に固定しておけば、隙間ができても白く見える。⚠️ 消さないこと */}
        <span aria-hidden data-state="bottom-nav-underlay"
          style={{ position: "absolute", left: 0, right: 0, top: "100%", height: 120, background: "#fff", pointerEvents: "none" }} />
        {tabs.map((tab) => {
          /* ⚠️ 登録タブの href はクエリ付き（`/auth?mode=signup`）なので、この判定では
                **決して active にならない。** 実害は無い ——`/auth` 配下ではこのナビ自体を
                出していない（上の early return）。判定をクエリ対応にする必要は無い。 */
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
                position: "relative",
                textDecoration: "none",
                /* ★選んでいないタブも読める濃さに（2026-10-19。--ink-mute だと薄くて押せる場所に見えなかった） */
                color: active ? "var(--royal)" : "var(--ink-soft)",
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
              {/* ★いまの画面のタブの上に線（2026-10-19 / LinkedIn と同じ見せ方）。色だけだと見分けにくかった */}
              {active && <span aria-hidden data-state="bottom-nav-active" style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 36, height: 3, borderRadius: "0 0 3px 3px", background: "var(--royal)" }} />}
              {tab.icon(active)}
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
