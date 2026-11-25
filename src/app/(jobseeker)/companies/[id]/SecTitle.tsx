import type React from "react";

/*
 * セクション見出し。**サーバー側のセクションとクライアント側の社員セクションの
 * 両方から使う**ため、page.tsx から切り出した（2026-08-09）。
 *
 * ★求人ページの本文の見出し（JobDetailView の H2）と同じ形にそろえた（2026-11-26 / 柴さんの指示）。
 *   ゴシック体 19px・太字・アイコンなし。それまでは明朝体 18px に四角いアイコンが付いていた。
 *   ⚠️ 片方だけ戻さないこと（2つのページで見出しの形が割れる）。
 *
 * ⚠️ hooks を使わない純粋な描画コンポーネントにしておくこと。
 *    どちらの文脈でも動く必要がある。state や effect を足すと
 *    サーバーコンポーネントから使えなくなる。
 */
export function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: "var(--space-2)",
        fontSize: 19,
        fontWeight: 700,
        color: "var(--ink)",
        lineHeight: 1.4,
      }}
    >
      {children}
    </h2>
  );
}
