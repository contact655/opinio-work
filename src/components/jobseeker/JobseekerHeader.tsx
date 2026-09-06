"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import OpinioLogo from "@/components/common/OpinioLogo";

/* ⚠️★`highlight` を廃止した（2026-08-30）。**5項目すべて `false` で、
      琥珀色の分岐（デスクトップ・モバイルの2箇所）は一度も描画されていなかった。**
      色は `#FEF3C7` / `#FDE68A` / `#D97706` / `#B45309` / `#92400E` で、
      `.claude/skills/ui-conventions`「色の役割」の**黄色背景は使わない**と
      **オレンジはカジュアル面談のみ**の両方に反する。
   ⚠️ ヘッダーは全ページに出るので、誰かが1つ `true` にした日に**サイト全体**へ出る。
      「使われていないから無害」ではなく、**選べる状態にしないこと**が対処
      （`88fae279` で `SecTitle` の未使用の色の選択肢を塞いだのと同じ）。
   ⚠️ ナビを強調したくなったら、**濃紺（主要な遷移）か太さ**で示す。 */
const NAV_LINKS = [
  { href: "/companies", label: "企業" },
  { href: "/jobs", label: "募集" },
  { href: "/people", label: "ユーザー" },
  { href: "/feed", label: "フィード" },
  { href: "/articles", label: "記事" },
];

type SuggestResult = {
  companies: { id: string; slug?: string | null; name: string; industry: string | null; logo_letter: string | null; logo_gradient: string | null }[];
  /** roleLabel は会社呼称 ?? 標準職種名。job_category は表示に使わない */
  jobs: { id: string; title: string; roleLabel: string | null }[];
};

const POPULAR_QUERIES = ["プロダクトマネージャー", "エンジニア", "カスタマーサクセス", "営業", "フルリモート", "外資系"];

export function JobseekerHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  /* `isBizMember` は「有効な企業所属が1件以上あるか」。true のときだけ
     ユーザーメニューに /biz/dashboard を出す（2026-09-05）。 */
  const [user, setUser] = useState<{ email: string; name: string; isBizMember: boolean } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestResult | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true; // アンマウント後の setState 防止（二重発火・競合ガード）

    /*
      ⚠️ **同じ auth ユーザーで2回引かないこと**（2026-08-13）。
         `getSession()` の then と `onAuthStateChange` の INITIAL_SESSION が
         ほぼ同時に発火するため、ページを開くたびに
         `ow_users?select=name` が**まったく同じ条件で2回**飛んでいた（実測）。
         resolvedAuthId に解決済みの id を持たせて2回目を捨てる。

      ⚠️ ログアウト（authUser=null）では必ず null に戻すこと。
         ここで早期 return すると、別アカウントに入り直したときに
         前の人の名前がヘッダーに残る。
    */
    let resolvedAuthId: string | null = null;

    async function resolveUser(authUser: { id: string; email?: string } | null | undefined) {
      if (!authUser) {
        resolvedAuthId = null;
        if (active) setUser(null);
        return;
      }
      if (resolvedAuthId === authUser.id) return;
      resolvedAuthId = authUser.id;

      /*
        ⚠️ **企業所属は埋め込みで取る。別クエリを足さないこと**（2026-09-05）。
           ヘッダーは全ページに載るので、往復を1回に減らした 2026-08-13 の経緯がある。
           `ow_company_admins` を別に引くと、その削減をそのまま打ち消す。

        ⚠️ **FK ヒント（`!ow_company_admins_user_id_fkey`）は省略できない。**
           `ow_company_admins` から `ow_users` への FK が **`user_id` と
           `invited_by_user_id` の2本**あるため、ヒント無しだと PostgREST が
           関係を決められず **`error` が返って埋め込みごと落ちる**。

        ⚠️ `error` を捨てないこと。捨てると RLS も GRANT も関係名の誤りも
           すべて「所属なし」に化け、**企業の人にリンクが出ないだけ**になる。
      */
      const { data: owUser, error: owUserErr } = await supabase
        .from("ow_users")
        .select("name, ow_company_admins!ow_company_admins_user_id_fkey(is_active)")
        .eq("auth_id", authUser.id)
        .maybeSingle();
      if (owUserErr) console.error("[JobseekerHeader] ow_users:", owUserErr.message);

      if (!active) return;
      const memberships = (owUser?.ow_company_admins ?? []) as { is_active: boolean | null }[];
      setUser({
        email: authUser.email ?? "",
        name: owUser?.name ?? authUser.email?.split("@")[0] ?? "",
        isBizMember: memberships.some((m) => m.is_active === true),
      });
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => resolveUser(session?.user))
      .catch(() => {
        // getSession 失敗時も loading を解除してボタンを表示する
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        resolveUser(session?.user);
        if (active) setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Search auto-focus + Escape close
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!searchOpen) { setSearchQuery(""); setSuggestions(null); }
  }, [searchOpen]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); setSuggestions(null); }
    }
    if (searchOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Debounced suggest fetch
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!searchQuery.trim()) { setSuggestions(null); return; }
    setSuggestLoading(true);
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) setSuggestions(await res.json());
      } catch { /* best-effort */ }
      setSuggestLoading(false);
    }, 250);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [searchQuery]);

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

  // Close mobile menu on pathname change or Escape key
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileMenuOpen(false); }
    if (mobileMenuOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setUser(null);
    window.location.href = "/";
  }

  return (
    <>
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
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center", color: "var(--brand-ink)" }}>
            <OpinioLogo height={24} />
          </Link>

          {/* Nav — desktop only */}
          <nav className="hidden md:flex" aria-label="メインナビゲーション" style={{ gap: 8, flex: 1, alignItems: "center" }}>
            {NAV_LINKS.map(({ href, label }) => {
              const [hrefPath, hrefQuery] = href.split("?");
              const hrefTab = hrefQuery ? new URLSearchParams(hrefQuery).get("tab") : null;
              const active = hrefTab
                ? pathname === hrefPath && searchParams.get("tab") === hrefTab
                : pathname.startsWith(hrefPath) && !searchParams.get("tab");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: active ? "var(--royal)" : "var(--ink-soft)",
                    textDecoration: "none",
                    borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
                    paddingTop: 0,
                    paddingRight: 8,
                    paddingBottom: 2,
                    paddingLeft: 8,
                    transition: "color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Link>
              );
            })}

          </nav>

          {/* Search icon — desktop */}
          <button
            type="button"
            className="hidden md:flex"
            onClick={() => setSearchOpen(true)}
            aria-label="検索"
            style={{
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, border: "1px solid var(--line)",
              background: "#fff", cursor: "pointer",
              color: "var(--ink-mute)",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; e.currentTarget.style.color = "var(--royal)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-mute)"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
            </svg>
          </button>

          {/* Spacer — mobile */}
          <div className="flex md:hidden" style={{ flex: 1 }} />

          {/* Auth actions — desktop */}
          <div className="hidden md:flex" style={{ gap: 10, alignItems: "center", flexShrink: 0 }}>
            {!loading && (
              user ? (
                /* ── Logged-in: message icon + bell + avatar button + dropdown ── */
                <>
                {/* メッセージアイコン — 🔍と🔔の間 */}
                <Link
                  href="/mypage/conversations"
                  aria-label="メッセージ"
                  style={{
                    width: 36, height: 36,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 8, border: `1px solid ${pathname === "/mypage/conversations" ? "var(--royal)" : "var(--line)"}`,
                    background: pathname === "/mypage/conversations" ? "var(--royal-50)" : "#fff",
                    color: pathname === "/mypage/conversations" ? "var(--royal)" : "var(--ink-mute)",
                    flexShrink: 0, textDecoration: "none",
                    transition: "border-color 0.15s, color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--royal)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = pathname === "/mypage/conversations" ? "var(--royal)" : "var(--line)"; (e.currentTarget as HTMLAnchorElement).style.color = pathname === "/mypage/conversations" ? "var(--royal)" : "var(--ink-mute)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </Link>
                <NotificationBell />
                {/* ⚠️★**企業担当者の常設スイッチ**（2026-09-05）。ベルとアバターの間。
                       畳んだドロップダウンの中だと、企業側と求職者側を行き来する人が
                       毎回2アクション必要になるため常時見える位置へ出した。

                    ⚠️ **出すのは `ow_company_admins` に有効な行がある人だけ。**
                       この列は「自分宛のもの」（自分のメッセージ・自分の通知）で揃えている。
                       所属が無い人にはアイコンを出さず、ドロップダウンの
                       「企業の方はこちら」（→ /business）だけを出す。
                    ⚠️ **`accepted_at` や `ow_job_assignees` を条件にしないこと。**
                       どちらも本番で該当0人（実測 2026-09-05）。誰にも出なくなる。
                    ⚠️ アイコン列はモバイルでは出ない（`hidden md:flex`）。
                       **モバイルメニュー側の項目を消さないこと。** */}
                {user.isBizMember && (
                  <Link
                    href="/biz/dashboard"
                    aria-label="企業の管理画面"
                    title="企業の管理画面"
                    style={{
                      width: 36, height: 36,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8, border: "1px solid var(--line)",
                      background: "#fff", color: "var(--ink-mute)",
                      flexShrink: 0, textDecoration: "none",
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--royal)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-mute)"; }}
                  >
                    {/* ⚠️ ビルのアイコンにしない。左ナビの「企業」（→ /companies・求職者向けの
                           企業一覧）と同じ絵になり、行き先を取り違える。 */}
                    <LayoutGrid size={16} strokeWidth={2.2} />
                  </Link>
                )}
                <div style={{ position: "relative" }} ref={dropdownRef}>
                  <button type="button"
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
                    <InitialAvatar name={user.name || user.email} size={32} />
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
                      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{user.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 2 }}>{user.email}</div>
                      </div>
                      <Link
                        href="/mypage"
                        onClick={() => setDropdownOpen(false)}
                        style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, textDecoration: "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                      >
                        マイページ
                      </Link>
                      {/* ⚠️★**全員に出す。ただし行き先は所属で変える**（2026-09-05）。
                             ログイン中は求職者側から企業側へ戻る導線が、これと下の
                             モバイルメニューしか無い。**消さないこと。**
                             未ログインのヘッダーには「企業の方はこちら」があるのに、
                             ログインすると消えていた（下の `) : (` 側）。

                          ⚠️ **所属が無い人を `/biz/dashboard` へ送らないこと。**
                             `NoTenantPage`（「企業アカウントが必要です。OPINIO運営より
                             送られた招待リンクからご参加ください」）に着いて行き止まりになる。
                             掲載を検討する人の入口は `/business`。 */}
                      {/* ⚠️★**企業担当者にはここへ出さない**（2026-09-05）。
                             同じ操作に到達できる入口が2つ並ぶと、片方を直したときに
                             もう片方が取り残される（職歴カードで実際に起きている）。
                             担当者の入口は**上のアイコン列に寄せた**。ここに戻さないこと。
                          ⚠️ 所属が無い人にだけ出す。文言は未ログイン側と同じ
                             「企業の方はこちら」にする。ログインの前後で呼び方を変えない。 */}
                      {!user.isBizMember && (
                        <Link
                          href="/business"
                          onClick={() => setDropdownOpen(false)}
                          style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, textDecoration: "none", borderTop: "0.5px solid var(--line-soft)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                        >
                          企業の方はこちら
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={handleLogout}
                        style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, background: "transparent", border: "none", cursor: "pointer", borderTop: "0.5px solid var(--line-soft)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        ログアウト
                      </button>
                    </div>
                  )}
                </div>
                </>
              ) : (
                <>
                  <Link href="/business" style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", textDecoration: "none", padding: "8px 10px", whiteSpace: "nowrap" }}>
                    企業の方はこちら
                  </Link>
                  <Link href="/auth" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", textDecoration: "none", padding: "8px 14px" }}>
                    ログイン
                  </Link>
                  <Link href="/auth?mode=signup" style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--royal)", textDecoration: "none", padding: "8px 18px", borderRadius: 8 }}>
                    無料登録
                  </Link>
                </>
              )
            )}
          </div>

          {/* Mobile: avatar (if logged in) + hamburger */}
          <div className="flex md:hidden" style={{ alignItems: "center", gap: 10, flexShrink: 0 }}>
            {!loading && user && (
              <InitialAvatar name={user.name || user.email} size={30} />
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
              aria-expanded={mobileMenuOpen}
              style={{
                width: 36, height: 36,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8,
              }}
            >
              <span style={{
                display: "block", width: 20, height: 1.5, background: "var(--ink-soft)", borderRadius: 2,
                transform: mobileMenuOpen ? "translateY(6.5px) rotate(45deg)" : "none",
                transition: "transform 0.2s",
              }} />
              <span style={{
                display: "block", width: 20, height: 1.5, background: "var(--ink-soft)", borderRadius: 2,
                opacity: mobileMenuOpen ? 0 : 1,
                transition: "opacity 0.15s",
              }} />
              <span style={{
                display: "block", width: 20, height: 1.5, background: "var(--ink-soft)", borderRadius: 2,
                transform: mobileMenuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none",
                transition: "transform 0.2s",
              }} />
            </button>
          </div>
        </div>
      </header>

      {/* Search overlay */}
      {searchOpen && (
        <>
          <div
            aria-hidden="true"
            style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.4)" }}
            onClick={() => setSearchOpen(false)}
          />
          <div
            role="search"
            aria-label="サイト検索"
            style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
            background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          }}>
            {/* 入力行 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchOpen(false);
                if (searchQuery.trim()) {
                  /* ★横断検索へ。2026-08-27 まで `/companies?q=` に直行していた。
                     ⚠️ **各一覧ページ（/companies /jobs /people）の検索窓は変えない。**
                        あちらは「その一覧の中の絞り込み」で役割が違う。 */
                  router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              style={{ maxWidth: 860, margin: "0 auto", height: 60, display: "flex", alignItems: "center", gap: 12, padding: "0 24px" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={suggestLoading ? "var(--royal)" : "var(--ink-mute)"} strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0, transition: "stroke 0.2s" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                aria-label="企業・職種で検索"
                aria-autocomplete="list"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="企業・職種で検索..."
                style={{
                  flex: 1, height: "100%", border: "none", outline: "none",
                  fontSize: 16, color: "var(--ink)",
                  fontFamily: "var(--font-inter), var(--font-noto)",
                  background: "transparent",
                }}
              />
              {searchQuery && (
                <button type="button" aria-label="検索をクリア" onClick={() => { setSearchQuery(""); setSuggestions(null); searchInputRef.current?.focus(); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--ink-mute)", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
              <button type="submit" style={{
                padding: "7px 18px", background: "var(--royal)", color: "#fff",
                borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}>検索</button>
              <button type="button" onClick={() => setSearchOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "var(--ink-mute)", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </form>

            {/* サジェストパネル */}
            <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px" }}>
              {/* クエリなし: 人気タグ + クイックリンク */}
              {!searchQuery && (
                <div style={{ padding: "12px 0 20px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>よく検索されるキーワード</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }}>
                    {POPULAR_QUERIES.map((q) => (
                      <button key={q} type="button"
                        onClick={() => { setSearchOpen(false); router.push(`/search?q=${encodeURIComponent(q)}`); }}
                        style={{ padding: "5px 13px", borderRadius: 100, border: "1px solid var(--line)", background: "var(--bg-tint)", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--ink-soft)" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>クイックナビ</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { href: "/companies", label: "企業一覧", icon: "🏢" },
                      { href: "/jobs",      label: "募集一覧", icon: "💼" },
                      { href: "/articles",  label: "記事",      icon: "📝" },
                    ].map(({ href, label, icon }) => (
                      <a key={href} href={href} onClick={() => setSearchOpen(false)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--line)", textDecoration: "none", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>
                        <span>{icon}</span>{label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* クエリあり: サジェスト結果 */}
              {searchQuery && suggestions && (
                <div style={{ paddingBottom: 16 }}>
                  {/* 企業 */}
                  {suggestions.companies.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>企業</div>
                      {suggestions.companies.map((c) => (
                        <a key={c.id} href={`/companies/${c.slug ?? c.id}`} onClick={() => setSearchOpen(false)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8, textDecoration: "none", transition: "background 0.1s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tint)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: c.logo_gradient ?? "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{c.logo_letter ?? c.name[0]}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                            {c.industry && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{c.industry}</div>}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 求人 */}
                  {suggestions.jobs.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>募集</div>
                      {suggestions.jobs.map((j) => (
                        <a key={j.id} href={`/jobs/${j.id}`} onClick={() => setSearchOpen(false)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8, textDecoration: "none", transition: "background 0.1s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tint)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--royal)", flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                            </svg>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{j.title}</div>
                            {j.roleLabel && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{j.roleLabel}</div>}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 全件検索リンク */}
                  <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10, marginTop: 4 }}>
                    <a href={`/search?q=${encodeURIComponent(searchQuery)}`} onClick={() => setSearchOpen(false)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 8, textDecoration: "none", fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                      「{searchQuery}」をまとめて検索 →
                    </a>
                  </div>
                </div>
              )}

              {/* クエリあり・結果なし */}
              {searchQuery && suggestions && suggestions.companies.length === 0 && suggestions.jobs.length === 0 && (
                <div style={{ padding: "16px 8px 20px", color: "var(--ink-mute)", fontSize: 13 }}>
                  「{searchQuery}」に一致する結果がありません。
                  <a href={`/search?q=${encodeURIComponent(searchQuery)}`} onClick={() => setSearchOpen(false)}
                    style={{ color: "var(--royal)", fontWeight: 600, marginLeft: 6, textDecoration: "underline" }}>まとめて検索 →</a>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed", inset: 0, zIndex: 99,
            background: "rgba(0,0,0,0.25)",
          }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ナビゲーションメニュー"
        aria-hidden={!mobileMenuOpen}
        className="md:hidden"
        style={{
          position: "fixed", top: 60, right: 0, bottom: 0, zIndex: 100,
          width: 280, maxWidth: "90vw",
          background: "#fff",
          borderLeft: "1px solid var(--line)",
          overflowY: "auto",
          transform: mobileMenuOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* User info (if logged in) */}
        {!loading && user && (
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <InitialAvatar name={user.name || user.email} size={40} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{user.name}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 2 }}>{user.email}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav aria-label="モバイルナビゲーション" style={{ padding: "8px 0", flex: 1 }}>
          {NAV_LINKS.map(({ href, label }) => {
            const [hrefPath, hrefQuery] = href.split("?");
            const hrefTab = hrefQuery ? new URLSearchParams(hrefQuery).get("tab") : null;
            const active = hrefTab
              ? pathname === hrefPath && searchParams.get("tab") === hrefTab
              : pathname.startsWith(hrefPath) && !searchParams.get("tab");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: "block",
                  padding: "14px 24px",
                  fontSize: 15,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--royal)" : "var(--ink)",
                  textDecoration: "none",
                  borderLeft: active ? "3px solid var(--royal)" : "3px solid transparent",
                  background: active ? "var(--royal-50)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {label}
              </Link>
            );
          })}

          {/* Logged-in extras */}
          {!loading && user && (
            <>
              <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
              <Link
                href="/mypage"
                onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", padding: "14px 24px", fontSize: 15, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
              >
                マイページ
              </Link>
              {/* ⚠️ デスクトップのドロップダウンと同じ条件・同じ行き先・同じ文言にすること。
                     片方だけに出すと「スマホからは自社の管理画面に入れない」になる。 */}
              <Link
                href={user.isBizMember ? "/biz/dashboard" : "/business"}
                onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", padding: "14px 24px", fontSize: 15, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
              >
                {user.isBizMember ? "企業の管理画面" : "企業の方はこちら"}
              </Link>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                style={{ width: "100%", textAlign: "left", display: "block", padding: "14px 24px", fontSize: 15, fontWeight: 500, color: "var(--ink-soft)", background: "none", border: "none", cursor: "pointer" }}
              >
                ログアウト
              </button>
            </>
          )}

          {/* Logged-out: login + signup */}
          {!loading && !user && (
            <>
              <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", padding: "14px 24px", fontSize: 15, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
              >
                ログイン
              </Link>
              <div style={{ padding: "12px 20px 16px" }}>
                <Link
                  href="/auth?mode=signup"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: "block", padding: "13px 20px", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--royal)", borderRadius: 10, textDecoration: "none", textAlign: "center" }}
                >
                  無料登録
                </Link>
              </div>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
