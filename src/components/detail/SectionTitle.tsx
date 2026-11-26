import type React from "react";

/**
 * ★企業詳細・募集詳細のセクション見出し（2026-11-26 / 柴さんの指示。2ページ共通）。
 *   h2・18px・太字・ゴシック。アイコンや左の縦線は付けない。
 *
 * ⚠️ hooks を使わない純粋な描画部品にしておくこと（サーバーとクライアントの両方の部品から使う）。
 * ⚠️ 明朝体にしない（この2ページはゴシックにそろえた）。
 * ⚠️ 企業ページの `companies/[id]/SecTitle.tsx` はこれを読み直しているだけ。形を変えるときはここだけ直す。
 */
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2
      style={{
        margin: 0,
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: "var(--space-2)",
        fontSize: 18,
        fontWeight: 700,
        color: "var(--ink)",
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}
