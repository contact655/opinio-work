"use client";

import Link from "next/link";
import { useMypageMock } from "./MypageMockContext";

// ─── SidebarItem ──────────────────────────────────────────────────────────────
// href を受け取り <Link> でレンダリングすることで Next.js の自動 prefetch を利用する

function SidebarItem({
  icon, label, active, badge, href, onClick,
}: {
  icon: React.ReactNode; label: string; active: boolean;
  badge?: number;
  /** href がある場合は <Link> でレンダリング（prefetch 有効）。ない場合は button */
  href?: string;
  onClick?: () => void;
}) {
  const itemStyle: React.CSSProperties = {
    width: "100%", textAlign: "left",
    padding: "10px 24px", fontSize: 13, fontWeight: active ? 600 : 500,
    color: active ? "var(--royal)" : "var(--ink-soft)",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "space-between",
    borderLeft: `3px solid ${active ? "var(--royal)" : "transparent"}`,
    background: active ? "var(--royal-50)" : "transparent",
    transition: "all 0.15s", fontFamily: "inherit",
    textDecoration: "none",
  };

  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: active ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 }}>
          {icon}
        </span>
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span style={{
          background: "var(--royal)", color: "#fff",
          fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
          padding: "1px 7px", borderRadius: 100, minWidth: 18, textAlign: "center",
        }}>
          {badge}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        style={itemStyle}
        className="mypage-nav-item"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={itemStyle}
      className="mypage-nav-item"
    >
      {inner}
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  briefcase:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/></svg>,
  application: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
  message:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  bookmark:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  check:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01 9 11.01"/></svg>,
  calendar:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  settings:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  // ν-8 段階1: Icons.user を復活（ν-7 段階1.5 の 5715091 で削除されたものを再追加）
  // /profile/edit の役割が「設定」→「プロフィール編集」に再定義されたため
  user:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

// ─── MypageLayout ─────────────────────────────────────────────────────────────

/** /mypage および配下サブページで使うナビゲーションキー。 */
export type MypageActiveKey =
  // SPA ビュー (/mypage)
  | "dashboard"
  | "casual"
  | "bookmarks"
  // サブページ (/mypage/conversations, /mypage/applications など)
  | "conversations"
  | "applications"
  // プロフィール編集ページ (/profile/edit)
  // ν-8 段階1: "settings" → "profile" に役割再定義。"settings" は過渡期互換のため残す。
  | "profile"
  | "settings";

export default function MypageLayout({
  activeKey,
  onNavigate,
  onIsMentorChange: _onIsMentorChange,
  conversationsBadge,
  applicationsBadge,
  children,
  rightColumn,
}: {
  activeKey: MypageActiveKey;
  /** SPA ビュー切替ハンドラ。/mypage でのみ使用。サブページでは未指定。 */
  onNavigate?: (key: MypageActiveKey) => void;
  onIsMentorChange?: (v: boolean) => void;
  conversationsBadge?: number;
  applicationsBadge?: number;
  children: React.ReactNode;
  rightColumn?: React.ReactNode;
}) {
  const { isMentor: _isMentor } = useMypageMock();
  const topOffset = 65;

  function _nav(key: MypageActiveKey) {
    onNavigate?.(key);
  }

  return (
    <>

      {/* モバイル: 横スクロールタブバー */}
      <nav aria-label="マイページナビゲーション" className="mypage-mobile-tabbar" style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        overflowX: "auto", WebkitOverflowScrolling: "touch" as unknown as undefined,
        position: "sticky", top: topOffset, zIndex: 40,
        display: "none", // hidden on desktop via CSS below
      }}>
        <div style={{ display: "flex", minWidth: "max-content", padding: "0 16px" }}>
          {[
            { key: "dashboard",      label: "ホーム",        href: "/mypage" },
            { key: "applications",   label: "応募管理",      href: "/mypage/applications" },
            { key: "conversations",  label: "メッセージ",    href: "/mypage/conversations" },
            { key: "bookmarks",      label: "ブックマーク",  href: "/mypage/bookmarks" },
            { key: "profile",        label: "プロフィール",  href: "/profile/edit" },
          ].map((item) => {
            const isActive = activeKey === item.key || (item.key === "profile" && (activeKey === "settings"));
            const badge = item.key === "applications" ? applicationsBadge : item.key === "conversations" ? conversationsBadge : undefined;
            return (
              <a
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "12px 16px", fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--royal)" : "var(--ink-soft)",
                  borderBottom: isActive ? "2px solid var(--royal)" : "2px solid transparent",
                  textDecoration: "none", whiteSpace: "nowrap",
                  transition: "color 0.15s",
                }}
              >
                {item.label}
                {badge && badge > 0 && (
                  <span style={{
                    background: "var(--error)", color: "#fff",
                    borderRadius: 100, fontSize: 9, fontWeight: 700,
                    padding: "1px 5px", fontFamily: "Inter, sans-serif",
                  }}>{badge}</span>
                )}
              </a>
            );
          })}
        </div>
      </nav>

      {/* デスクトップ: グリッドレイアウト */}
      <div className="mypage-desktop-grid" style={{ display: "grid", gridTemplateColumns: rightColumn ? "260px 1fr 320px" : "260px 1fr", minHeight: `calc(100vh - ${topOffset}px)`, maxWidth: 1440, margin: "0 auto" }}>

        {/* 左サイドバー（デスクトップのみ） */}
        <aside style={{
          background: "#fff", borderRight: "1px solid var(--line)",
          padding: "var(--space-6) 0",
          position: "sticky", top: topOffset, alignSelf: "start",
          height: `calc(100vh - ${topOffset}px)`, overflowY: "auto",
        }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "0 24px 10px",
          }}>
            マイページ
          </div>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            <SidebarItem icon={Icons.dashboard}   label="ホーム"        active={activeKey === "dashboard"}      href="/mypage" />
            <SidebarItem icon={Icons.application} label="応募管理"      active={activeKey === "applications"}   badge={applicationsBadge}   href="/mypage/applications" />
            <SidebarItem icon={Icons.message}     label="メッセージ"    active={activeKey === "conversations"}  badge={conversationsBadge}  href="/mypage/conversations" />
            <SidebarItem icon={Icons.bookmark}    label="ブックマーク"  active={activeKey === "bookmarks"}      href="/mypage/bookmarks" />
          </nav>


          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "20px 24px 8px",
          }}>
            アカウント
          </div>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            <SidebarItem icon={Icons.user} label="プロフィール" active={activeKey === "profile" || activeKey === "settings"} href="/profile/edit" />
          </nav>
        </aside>

        {/* メインコンテンツ */}
        <main id="main-content" style={{ padding: "36px 40px 60px" }} className="mypage-main-content">
          {children}
        </main>

        {/* 右サイドバー（rightColumn がある場合のみ描画） */}
        {rightColumn && (
          <aside style={{
            padding: "36px 24px 60px",
            position: "sticky", top: topOffset, alignSelf: "start",
            height: `calc(100vh - ${topOffset}px)`, overflowY: "auto",
            borderLeft: "1px solid var(--line)",
          }}>
            {rightColumn}
          </aside>
        )}
      </div>

      <style>{`
        .mypage-nav-item:hover { background: var(--bg-tint) !important; color: var(--ink) !important; }

        /* Mobile: show tab bar, hide sidebar grid */
        @media (max-width: 767px) {
          .mypage-mobile-tabbar { display: block !important; }
          .mypage-desktop-grid  { display: block !important; grid-template-columns: none !important; }
          .mypage-desktop-grid > aside { display: none !important; }
          .mypage-main-content  { padding: 20px 16px 60px !important; }
        }
      `}</style>
    </>
  );
}
