"use client";

import { MYPAGE_MAIN_COLUMN } from "@/lib/constants/layout";
import Link from "next/link";
import { Breadcrumb, type Crumb } from "@/components/ui/Breadcrumb";

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
          fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
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
  inbox:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  salary:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
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
  | "scouts"
  // プロフィール編集ページ (/profile/edit)
  // ν-8 段階1: "settings" → "profile" に役割再定義。"settings" は過渡期互換のため残す。
  | "profile"
  | "settings"
  | "salary";

/*
  ⚠️ 2026-08-06 に onNavigate / onIsMentorChange を削除した。どちらも受け取るだけで
     使っていなかった。サイドバーのリンクを SPA 切替にする設計の名残で、
     いまは通常の遷移になっている。onIsMentorChange は渡し元も () => {} だった。
*/
export default function MypageLayout({
  activeKey,
  conversationsBadge,
  applicationsBadge,
  scoutsBadge,
  children,
  rightColumn,
  rightColumnCollapse = "stack",
  breadcrumb,
}: {
  activeKey: MypageActiveKey;
  conversationsBadge?: number;
  applicationsBadge?: number;
  /** 未返答のスカウト件数。0 のときは出さない */
  scoutsBadge?: number;
  children: React.ReactNode;
  rightColumn?: React.ReactNode;
  /**
   * 1100px 未満で右カラムをどう畳むか。
   *   stack … 本文の下に回す（既定。/mypage のバナーのように消すと情報が失われるもの）
   *   hide  … 消す（本文側に `.mypage-narrow-only` で控えを置いてあるもの）
   * ⚠️ 767px 以下では左右どちらの aside も display:none になる。
   */
  rightColumnCollapse?: "stack" | "hide";
  /** ヘッダー直下に全幅で敷くパンくず。渡さなければ出さない */
  breadcrumb?: Crumb[];
}) {
  const topOffset = 65;

  return (
    <>
      {/* ⚠️ グリッドより前に置く。全幅で敷きたいので、サイドバーの外側になる */}
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}

      {/* モバイル: 横スクロールタブバー */}
      <nav aria-label="マイページナビゲーション" className="mypage-mobile-tabbar" style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        overflowX: "auto", WebkitOverflowScrolling: "touch" as unknown as undefined,
        position: "sticky", top: topOffset, zIndex: 40,
        display: "none", // hidden on desktop via CSS below
      }}>
        {/* ★アイコンを上・ラベルを下の2段組にして、5項目を等幅で収める（2026-08-16）。
               横並び1段では中身 502px に対して枠が 375px しかなく、
               **「ブックマーク」が初期表示で完全に隠れていた**（`overflow-x: auto`
               なのでスクロールはできるが、あることに気づけない）。
            ⚠️ `minWidth: max-content` をやめる。これがあると等幅にならない。 */}
        <div style={{ display: "flex", padding: "0 4px" }}>
          {[
            { key: "dashboard",      label: "ホーム",        href: "/mypage",               icon: Icons.dashboard },
            { key: "applications",   label: "応募管理",      href: "/mypage/applications",  icon: Icons.application },
            { key: "scouts",         label: "スカウト",      href: "/mypage/scouts",        icon: Icons.inbox },
            { key: "conversations",  label: "メッセージ",    href: "/mypage/conversations", icon: Icons.message },
            { key: "bookmarks",      label: "ブックマーク",  href: "/mypage/bookmarks",     icon: Icons.bookmark },
            /* ★設定（2026-08-17 / フェーズ4-1）。
                  ⚠️ **モバイルにも出す。** 左のサイドバーは 960px 未満で消えるので、
                     ここに無いと**スマホから設定に行く手段が1つも無くなる**。
                     6項目でも 375px で1項目 62px、ラベルは10pxなので収まる（実測）。 */
            { key: "settings",       label: "設定",          href: "/mypage/settings",      icon: Icons.settings },
          ].map((item) => {
            const isActive = activeKey === item.key || (item.key === "profile" && (activeKey === "settings"));
            const badge =
              item.key === "applications" ? applicationsBadge
              : item.key === "conversations" ? conversationsBadge
              : item.key === "scouts" ? scoutsBadge
              : undefined;
            return (
              <a
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  /* ★等幅。375px なら6項目で1項目 62px 前後に収まる */
                  flex: "1 1 0", minWidth: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "6px 2px", fontSize: 10, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--royal)" : "var(--ink-soft)",
                  borderBottom: isActive ? "2px solid var(--royal)" : "2px solid transparent",
                  textDecoration: "none", whiteSpace: "nowrap",
                  transition: "color 0.15s",
                }}
              >
                {/* バッジはアイコンの右上に重ねる（1段目に置くと等幅が崩れる） */}
                <span style={{ position: "relative", display: "flex", lineHeight: 0 }}>
                  {item.icon}
                  {/* ⚠️ `badge &&` にしない。**`badge` が 0 のとき React は `0` を描く**
                         （2026-08-16 に実測。ラベルの横に「0」が出ていた）。
                         左のサイドバー（38行目）は最初から `!== undefined` で書けている。 */}
                  {badge !== undefined && badge > 0 && (
                    <span style={{
                      position: "absolute", top: -6, left: 10,
                      background: "var(--error)", color: "#fff",
                      borderRadius: 100, fontSize: 10, fontWeight: 700,
                      padding: "0 4px", fontFamily: "Inter, sans-serif", lineHeight: "14px",
                    }}>{badge}</span>
                  )}
                </span>
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>

      {/* デスクトップ: グリッドレイアウト */}
      {/* ⚠️ minmax(0, 1fr) にすること。1fr のままだと中身の最小幅で本文が押し広げられ、
             右カラムがあるときに横スクロールが出る（1100px 未満で実際に出ていた）。 */}
      {/* ★本文列の幅は `lib/constants/layout.ts` の `MYPAGE_MAIN_COLUMN`（2026-08-27）。
             同じプロフィールが、自分で見るときと他人が見るときで幅が違っていた。
             ⚠️ **本文列には左右 40 の余白がある**ので、公開側（`/u/[id]`）の内容幅 1020 に
                揃えるには **1100** が要る。数字はここに書かず定数を見ること。
          ⚠️ `minmax(0, …)` なので、画面が狭いときは従来どおり縮む。
             外枠はそれ以上のとき中央寄せ。 */}
      <div className="mypage-desktop-grid" style={{ display: "grid", gridTemplateColumns: rightColumn ? `260px minmax(0, ${MYPAGE_MAIN_COLUMN}px) 320px` : `260px minmax(0, ${MYPAGE_MAIN_COLUMN}px)`, minHeight: `calc(100vh - ${topOffset}px)`, maxWidth: rightColumn ? 260 + MYPAGE_MAIN_COLUMN + 320 : 260 + MYPAGE_MAIN_COLUMN, margin: "0 auto" }}>

        {/* 左サイドバー（デスクトップのみ） */}
        <aside className="mypage-left-aside" style={{
          background: "#fff", borderRight: "1px solid var(--line)",
          padding: "var(--space-6) 0",
          position: "sticky", top: topOffset, alignSelf: "start",
          height: `calc(100vh - ${topOffset}px)`, overflowY: "auto",
        }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "0 24px 10px",
          }}>
            マイページ
          </div>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            <SidebarItem icon={Icons.dashboard}   label="ホーム"        active={activeKey === "dashboard"}      href="/mypage" />
            <SidebarItem icon={Icons.application} label="応募管理"      active={activeKey === "applications"}   badge={applicationsBadge}   href="/mypage/applications" />
            <SidebarItem icon={Icons.inbox}       label="スカウト"      active={activeKey === "scouts"}         badge={scoutsBadge}         href="/mypage/scouts" />
            <SidebarItem icon={Icons.message}     label="メッセージ"    active={activeKey === "conversations"}  badge={conversationsBadge}  href="/mypage/conversations" />
            <SidebarItem icon={Icons.bookmark}    label="ブックマーク"  active={activeKey === "bookmarks"}      href="/mypage/bookmarks" />
          </nav>

          {/* ⚠️ 「アカウント > プロフィール」は 2026-08-16 に削除した。
                 プロフィールの中身は「ホーム」（/mypage）そのものになったので、
                 同じ場所へ行く入口が2つ並んでいた（ルール⑧）。 */}
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "24px 24px 10px",
          }}>
            アカウント
          </div>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            <SidebarItem icon={Icons.settings} label="設定" active={activeKey === "settings"} href="/mypage/settings" />
          </nav>
        </aside>

        {/* メインコンテンツ */}
        {/* ★本文の背景を薄グレー（`--bg-tint`）にする（2026-08-27）。
               ⚠️ **カードも本文も body も全部 `#fff` で、白の上に白**だった。
                  区切りは 1px の枠だけで、カードの境目が読めない。
               ⚠️ 公開プロフィール（`/u/[id]`）は**元からこの形**
                  （コンテナが `--bg-tint`／カードが白＋影）。**あちらに揃えた。**
               ⚠️ カード側を濃くする方向で直さないこと。カードは白のままにして
                  **地の色を下げる**のが、`--bg-tint` の本来の使い方
                  （globals.css に「ページ背景 (薄グレー)」と書いてある）。 */}
        <main id="main-content" style={{ padding: "36px 40px 60px", background: "var(--bg-tint)" }} className="mypage-main-content">
          {children}
        </main>

        {/* 右サイドバー（rightColumn がある場合のみ描画） */}
        {rightColumn && (
          /* ⚠️ **右サイドバーを独立したスクロール枠にしないこと（2026-08-23）。**
                以前は `position: sticky` ＋ `height: calc(100vh - topOffset)` ＋
                `overflowY: auto` で、**中身が画面の高さを超えると最後のカードが切れていた**。
                切れるのは常に一番下のカード（「採用担当者・企業の方はこちら」）で、
                内側にスクロールできること自体が見た目から分からなかった。

                実測（テスト用アカウント・中身611px）:
                  ウィンドウ700px … 枠548px → 3px 切れ
                  ウィンドウ600px … 枠448px → 103px 切れ
                  ウィンドウ520px … 枠368px → 183px 切れ
                カードが多い利用者では通常の画面高でも切れる。

             ⚠️ **`height` を `max-height` に変えるだけでは直らない。** 中身が
                画面より高ければ結局スクロール枠になり、見た目は切れたままになる。
             ⚠️ **sticky を残したまま高さ指定だけ外すのは最悪。** 上に貼り付いたまま
                下端に到達する手段が無くなる。外すなら sticky ごと外す。
             ⚠️ 左の `mypage-left-aside` は**そのまま**。あちらはナビで中身が短く、
                貼り付いていることに意味がある。 */
          <aside className={`mypage-right-aside${rightColumnCollapse === "hide" ? " mypage-right-hide" : ""}`} style={{
            padding: "36px 24px 60px",
            alignSelf: "start",
            borderLeft: "1px solid var(--line)",
          }}>
            {rightColumn}
          </aside>
        )}
      </div>

      {/*
        ⚠️ この CSS には `>` と `"` を書かない（2026-08-07）。
        JSX の `<style>{`…`}</style>` は、その2文字を
        **サーバー側だけが `&gt;` / `&quot;` にエスケープする**。
        結果、毎リクエスト hydration mismatch になり
        「Text content does not match server-rendered HTML」で
        ツリーごとクライアント再描画に落ちていた（/mypage と /profile/edit）。
        子孫セレクタは `>` を使わずクラスを足して書くこと。
      */}
      <style>{`
        .mypage-nav-item:hover { background: var(--bg-tint) !important; color: var(--ink) !important; }

        /* 右カラムが畳まれる幅で、本文側に置いた控えと入れ替える。
           .mypage-narrow-only は rightColumnCollapse に hide を渡すのとセットで使う。 */
        .mypage-narrow-only { display: none; }

        /* 3カラムを維持できない幅。1100px 未満だと本文の内側が 424px を切り、
           入力欄が並ばなくなる（/mypage は 800px で横スクロールまで出ていた）。 */
        @media (max-width: 1099px) {
          .mypage-desktop-grid { grid-template-columns: 260px minmax(0, 1fr) !important; }
          .mypage-right-aside {
            grid-column: 2 / -1;
            position: static !important; height: auto !important; overflow: visible !important;
            border-left: none !important; padding: 0 40px 60px !important;
          }
          .mypage-right-hide  { display: none !important; }
          .mypage-narrow-only { display: block; }
        }

        /* Mobile: show tab bar, hide left sidebar
           ★右カラムは**消さない**（2026-08-16）。消していたせいで、公開促進と
             スカウト設定がモバイルからは一切見えなかった（代わりの導線も無かった）。
           ⚠️ **控えを本文側に作らない。** グリッドを縦並びの flex に切り替えて、
             同じ要素を order で本文の上へ動かす。同じ内容を2箇所に持つと、
             片方だけ直る形の不具合になる（/profile/edit の完成度バーで一度やった）。 */
        @media (max-width: 767px) {
          .mypage-mobile-tabbar { display: block !important; }
          .mypage-desktop-grid  { display: flex !important; flex-direction: column !important; grid-template-columns: none !important; }
          .mypage-left-aside { display: none !important; }
          .mypage-right-aside {
            order: -1;
            position: static !important; height: auto !important; overflow: visible !important;
            border-left: none !important; padding: 16px 16px 0 !important;
            /* ★2026-08-26 追加。**幅いっぱいに広げる。**
               インラインの align-self: start は「デスクトップで sticky を上端に貼る」ための
               指定だが、767px 以下では**縦積みの flex** になるため、同じ指定が
               **横方向の縮み**として効き、右カラムが中身の max-content 幅に潰れていた。
               ⚠️ 実測（375px / 2026-08-26）: 375px の枠に対して aside 269px・カード 237px。
                  **画面の 28% が使われていなかった。** 中身の幅で決まるので、
                  カードの文言を短くするほど狭くなるという逆向きの挙動にもなっていた。
               ⚠️ grid（1100px 未満）側には要らない。あちらの align-self は縦方向なので
                  幅には効かない。 */
            align-self: stretch !important;
          }
          /* 右カラムのうち**モバイルでは出さないもの**。ここで消す（本文側に控えを作らない） */
          .mypage-hide-mobile { display: none !important; }
          /* モバイルは「設定できないままスカウトが届かない」ほうが重いので先に出す */
          .mypage-mobile-first { order: -1; }
          .mypage-main-content  { padding: 20px 16px 60px !important; }
        }
      `}</style>
    </>
  );
}
