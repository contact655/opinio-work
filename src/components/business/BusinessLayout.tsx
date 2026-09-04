"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { CompanySwitcher } from "./CompanySwitcher";
import type { TenantCompany } from "@/lib/business/dashboard";
import { LayoutGrid, Building2, Briefcase, Users, Newspaper, ChevronDown, Layers, BarChart2, Inbox, UsersRound, Send, Search, Calendar } from "lucide-react";

type BusinessLayoutVariant = "default" | "fullBleed";

type Props = {
  userName: string;
  tenantName?: string;
  tenantLogoGradient?: string | null;
  tenantLogoLetter?: string | null;
  variant?: BusinessLayoutVariant;
  children: React.ReactNode;
  memberships?: TenantCompany[];
  currentTenantId?: string;
  /**
   * ⚠️★**企業が紐付いていないときは `false` を渡す**（2026-09-04 / 柴さんの指摘）。
   *
   * 企業が無いのに **12項目のサイドバーが出ていた。** 押すと `BizNoTenantPage`
   * （「企業アカウントが必要です」）へ着くだけで、**どれ一つ使えない。**
   * 登録直後・承認待ちの人には「使える機能が並んでいる」ようにしか見えず、
   * 押して初めて行き止まりだと分かる形だった。
   *
   * ⚠️ 灰色にして無効化する案は採らない。**押せないものを並べる意味が無い**
   *    （CLAUDE.md「値が無いことを、ある値に置き換えない」と同じ）。**出さない。**
   *
   * ⚠️ `loading.tsx` の骨組みには渡さないこと（既定の `true` のまま）。
   *    あれは**企業がある人**のページの骨組みで、`false` にすると
   *    サイドバーが消えてから生えるちらつきになる。
   */
  hasCompany?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactElement;
  children?: { href: string; label: string }[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/biz/dashboard",
    label: "ホーム",
    icon: <LayoutGrid size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/company",
    label: "企業情報",
    icon: <Building2 size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/organization",
    label: "組織体制",
    icon: <Layers size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/employees",
    label: "社員管理",
    icon: <UsersRound size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/jobs",
    label: "求人管理",
    icon: <Briefcase size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/candidates",
    label: "候補者を探す",
    icon: <Search size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/meetings",
    label: "選考管理",
    icon: <Calendar size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/scouts",
    label: "スカウト履歴",
    icon: <Send size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/conversations",
    label: "メッセージ",
    icon: <Inbox size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/posts",
    label: "投稿・発信",
    icon: <Newspaper size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/members",
    label: "チーム管理",
    icon: <Users size={16} strokeWidth={2.2} />,
  },
  {
    href: "/biz/analytics",
    label: "分析",
    icon: <BarChart2 size={16} strokeWidth={2.2} />,
  },
];


export function BusinessLayout({
  userName,
  tenantName,
  tenantLogoGradient,
  tenantLogoLetter,
  variant = "default",
  children,
  memberships,
  currentTenantId,
  hasCompany = true,
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

  const userInitial = userName.trim().charAt(0).toUpperCase() || null;
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
      fontFamily: "var(--font-inter), var(--font-noto)",
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* ── Topbar ── */}
      {/* ⚠️★ヘッダーは 2026-08-31 まで `@media` の対象外だった。
             `display:flex` / `gap:24` / `padding:12px 28px` の固定で、
             375px では**企業切り替えが右端 443px、ユーザーメニューが 601px** まで出ており、
             `body { overflow-x: hidden }` に**切り取られていた**（横スクロールは出ない）。
             ＝ スマホでは企業の切り替えとアカウントメニューに触れなかった。
          ⚠️ サイドバー側の ≤768px 対応は元からあった。**ヘッダーだけ漏れていた。** */}
      <header className="biz-header" style={{
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
        <Link href="/biz/dashboard" className="biz-header-brand" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <span style={{
            fontFamily: "var(--font-inter), var(--font-noto)",
            fontWeight: 700, fontSize: 20,
            color: "var(--royal)",
            letterSpacing: "-0.02em",
          }}>OPINIO</span>
          <span style={{
            fontFamily: "var(--font-inter), var(--font-noto)",
            fontSize: 9, fontWeight: 700,
            letterSpacing: "0.15em",
            padding: "2px 7px",
            background: "var(--royal)", color: "#fff",
            borderRadius: 3,
            textTransform: "uppercase",
          }} className="biz-header-badge">Business</span>
        </Link>

        {/* Company identifier / switcher */}
        {tenantName && (
          memberships && currentTenantId ? (
            <div className="biz-header-company" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <CompanySwitcher
                currentCompany={{ id: currentTenantId, name: tenantName, logoGradient: tenantLogoGradient, logoLetter: tenantLogoLetter }}
                memberships={memberships}
              />
            </div>
          ) : (
            <div className="biz-header-company" style={{
              display: "flex", alignItems: "center", gap: 8,
              paddingLeft: 20, minWidth: 0,
              borderLeft: "1px solid var(--line)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: logoGradient,
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, fontSize: 13,
                flexShrink: 0,
              }}>
                {logoLetter}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tenantName}
              </span>
            </div>
          )
        )}

        <div style={{ flex: 1 }} />

        {/* User menu */}
        <div className="relative biz-header-user" ref={avatarRef} style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setAvatarOpen(!avatarOpen)}
            aria-label="アカウントメニュー"
            aria-expanded={avatarOpen}
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
              background: userInitial
                ? "linear-gradient(135deg, var(--royal), var(--accent))"
                : "var(--line)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 12,
            }}>
              {userInitial ?? null}
            </div>
            {/* ⚠️ 狭い画面ではこの2行を隠す（アバターとシェブロンは残す）。
                   隠さないと押せる領域ごと画面外へ出る。 */}
            <div className="biz-header-username" style={{ textAlign: "left", minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400 }}>Admin</div>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: "var(--ink-mute)",
                transform: avatarOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                flexShrink: 0,
              }}
            />
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
                href="/mypage"
                onClick={() => setAvatarOpen(false)}
                style={{
                  display: "block", padding: "10px 16px",
                  fontSize: 13, color: "var(--ink-soft)", fontWeight: 500,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                個人プロフィール編集
              </Link>
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
                type="button"
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
      {/* ⚠️ 企業が無いときは1列。列だけ残すと本文が右に寄り、
             「サイドバーが読み込み中」に見える。 */}
      <div className="biz-layout-grid" style={{ display: "grid", gridTemplateColumns: hasCompany ? "240px 1fr" : "1fr", minHeight: "calc(100vh - 57px)" }}>

        {/* Sidebar
            ⚠️★**企業が紐付いていないときは丸ごと出さない**（2026-09-04 / 柴さんの指摘）。
               12項目とも `BizNoTenantPage` へ着くだけで、使えるものが1つも無い。
               詳細は `Props.hasCompany` の注記。 */}
        {hasCompany && (
        <aside className="biz-layout-sidebar" style={{
          background: "#fff",
          borderRight: "1px solid var(--line)",
          padding: "20px 0",
          position: "sticky",
          top: 57,
          alignSelf: "start",
          height: "calc(100vh - 57px)",
          overflowY: "auto",
          outline: "none",
        }}>
          {/* ⚠️ 狭い画面では隠す（横スクロールの列に見出しを混ぜない）。クラスは CSS 側で使う */}
          <div className="biz-nav-heading" style={{
            fontFamily: "var(--font-inter), var(--font-noto)",
            fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
            letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "0 20px 8px",
          }}>
            採用活動
          </div>

          <nav>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              // 子リンクのどれかが active かどうか
              const childActive = item.children?.some(
                (c) => pathname === c.href || pathname.startsWith(c.href + "/")
              ) ?? false;
              // 子が active な時は親をサブデュード表示 (背景なし・テキストのみ royal)
              const showFullActive = active && !childActive;

              const badgeCount = 0;

              return (
                <div key={item.href} className="biz-nav-item">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 20px",
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      color: active ? "var(--royal)" : "var(--ink-soft)",
                      textDecoration: "none",
                      borderLeft: `3px solid ${showFullActive ? "var(--royal)" : "transparent"}`,
                      background: showFullActive ? "var(--royal-50)" : "transparent",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!showFullActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)";
                        if (!childActive) (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showFullActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                        if (!childActive) (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)";
                      }
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: active ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </span>
                    {badgeCount > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, borderRadius: 100,
                        background: "var(--error)", color: "#fff",
                        fontSize: 10, fontWeight: 700, fontFamily: "var(--font-inter), var(--font-noto)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 5px", flexShrink: 0,
                      }}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </Link>

                  {/* サブリンク: 親が active な時だけ展開 */}
                  {active && item.children?.map((child) => {
                    const childIsActive = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        /* ⚠️ 狭い画面では隠す。横スクロールの列に子リンクを混ぜると
                              親と子の区別が付かなくなる（インデントが効かないため） */
                        className="biz-nav-child"
                        style={{
                          display: "flex", alignItems: "center",
                          padding: "6px 20px 6px 38px",
                          fontSize: 12, fontWeight: childIsActive ? 600 : 500,
                          color: childIsActive ? "var(--royal)" : "var(--ink-mute)",
                          textDecoration: "none",
                          borderLeft: `3px solid ${childIsActive ? "var(--royal)" : "transparent"}`,
                          background: childIsActive ? "var(--royal-50)" : "transparent",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (!childIsActive) {
                            (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)";
                            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!childIsActive) {
                            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-mute)";
                          }
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                            background: childIsActive ? "var(--royal)" : "var(--line)",
                          }} />
                          {child.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

        </aside>
        )}

        {/* Main content */}
        {/* ⚠️ 企業が無いときはサイドバーを出さないので、**本文を中央に寄せる**
               （2026-09-04）。左寄せのままだと 1440px で左端に貼り付き、
               右が大きく空いて「サイドバーが消えた」ように見える。
               ここは登録フローなので、`/biz/auth` と同じ中央寄せに揃える。 */}
        <main id="main-content" className="biz-layout-main" style={variant === "fullBleed"
          ? { padding: 0, minWidth: 0, overflow: "hidden" }
          : hasCompany
            ? { padding: "28px 36px 60px", maxWidth: 1200, minWidth: 0 }
            : { padding: "28px 36px 60px", maxWidth: 960, minWidth: 0, margin: "0 auto", width: "100%" }
        }>
          {children}
        </main>
      </div>

      {/* Mobile fallback nav (≤768px) */}
      <style>{`
        /* ── ヘッダー（2026-08-31 追加）──────────────────────────────────
           ⚠️ 段階を2つに分ける。768px では詰めるだけ、480px で要素を落とす。
              いきなり落とすとタブレットで情報が減りすぎる。 */
        @media (max-width: 768px) {
          .biz-header { padding: 10px 14px !important; gap: 10px !important; }
          .biz-header-company { padding-left: 10px !important; }
        }
        @media (max-width: 480px) {
          /* ⚠️ ロゴの「BUSINESS」バッジは落とす。OPINIO の文字だけで区別は付く */
          .biz-header-badge { display: none !important; }
          /* ⚠️ 氏名と Admin は落とす。**アバターとシェブロンは残す**
                （押せる場所が消えるとメニューを開けなくなる） */
          .biz-header-username { display: none !important; }
          .biz-header-user button { padding: 6px !important; gap: 0 !important; }
        }

        @media (max-width: 768px) {
          .biz-layout-grid { grid-template-columns: 1fr !important; }
          .biz-layout-sidebar {
            position: static !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid var(--line) !important;
            padding: 8px 0 !important;
          }
          /* ⚠️★flex-direction: row だけでは効かなかった（2026-08-31 に実測）。
                nav は素の display:block なので、方向を指定しても縦のままで、
                12項目がフルハイトで縦に並び、本文が画面のはるか下に押し出されていた。
                display:flex を先に当てる必要がある。
             ⚠️★この style ブロックの中でバッククォートを使わないこと。
                テンプレートリテラルがそこで閉じ、以降が JSX として解釈される
                （2026-08-31 に実際に踏んだ。tsc が「nav に閉じタグが無い」と言い出す）。
                CLAUDE.md の「子孫セレクタの記号と引用符を使わない」と同じ場所の話。 */
          .biz-layout-sidebar nav {
            display: flex !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            gap: 2px;
            padding: 0 12px;
            scrollbar-width: none;
          }
          .biz-layout-sidebar nav::-webkit-scrollbar { display: none; }
          .biz-nav-item { flex: 0 0 auto; }
          .biz-layout-sidebar nav a { white-space: nowrap; }
          /* ⚠️ 見出し（採用活動）と、開いている項目の子リンクは畳む。
                横スクロールの列に混ぜると、親と子の区別が付かなくなる。 */
          .biz-nav-heading { display: none !important; }
          .biz-nav-child { display: none !important; }
          .biz-layout-main { padding: 20px 16px 48px !important; }
        }
      `}</style>
    </div>
  );
}
