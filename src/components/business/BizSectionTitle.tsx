import type React from "react";

/**
 * 企業の管理画面（/biz）の見出し（2026-11-25 / 柴さんの指示）。
 *
 * 求職者側の求人ページ・企業ページ・マイページと同じ形にそろえた:
 *   節の見出し（BizSectionTitle） … 明朝体 18px・太さ700・四角いアイコン（30px・角丸8）
 *   画面の題（BizPageTitle）       … 明朝体 20px・太さ700
 *
 * ★まずは主な画面（ホーム・候補者を探す・メッセージ・求人管理・企業ページ）だけ。
 *   ほかの画面は、見出しを直すときにこの部品へ寄せること。⚠️ 画面ごとに大きさを書き写さない
 *   （それまで約25画面で 14〜26px がばらばらだった）。
 */
export function BizSectionTitle({
  icon,
  children,
  as: Tag = "h2",
  style,
}: {
  /** svg の中身（path など）。枠と色はこの部品が持つ */
  icon: React.ReactNode;
  children: React.ReactNode;
  as?: "h2" | "h3";
  style?: React.CSSProperties;
}) {
  return (
    <Tag style={{
      display: "flex", alignItems: "center", gap: "var(--space-3)", margin: 0,
      fontFamily: "var(--font-noto-serif)", fontSize: 18, fontWeight: 700,
      color: "var(--ink)", letterSpacing: "0.01em", lineHeight: 1.3,
      ...style,
    }}>
      <span aria-hidden style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: "var(--royal-50)", color: "var(--royal)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </Tag>
  );
}

/** 画面の題。⚠️ margin などは呼び出し側が style で渡す（画面ごとに置き場所が違うため） */
export function BizPageTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h1 style={{
      margin: 0, fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700,
      color: "var(--ink)", letterSpacing: "0.01em", lineHeight: 1.4,
      ...style,
    }}>
      {children}
    </h1>
  );
}

/** よく使うアイコン（svg の中身） */
export const BIZ_ICONS = {
  todo: <><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></>,
  tag: <><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
};
