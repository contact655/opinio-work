import type React from "react";

/*
 * セクション見出し。**サーバー側のセクションとクライアント側の社員セクションの
 * 両方から使う**ため、page.tsx から切り出した（2026-08-09）。
 *
 * ⚠️ hooks を使わない純粋な描画コンポーネントにしておくこと。
 *    どちらの文脈でも動く必要がある。state や effect を足すと
 *    サーバーコンポーネントから使えなくなる。
 */
export function SecTitle({
  icon,
  children,
  iconColor = "default",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  /**
   * ⚠️★`purple` と `warm` は 2026-08-29 に削除した。**戻さないこと。**
   *  実測で**呼び出し4箇所すべてが `default`** で、一度も使われていなかった。
   *  `.claude/skills/ui-conventions`「色の役割」は
   *    **紫＝使わない／オレンジ＝カジュアル面談だけ**
   *  と定めているので、選べる状態にしておくと規約違反を招く。
   * ⚠️ `green` は残す（`--success` は「金銭的にプラス」の役割で定義がある）。
   */
  iconColor?: "default" | "green";
}) {
  const iconBg: Record<string, string> = {
    default: "var(--royal-50)",
    green: "var(--success-soft,#ECFDF5)",
  };
  const iconFg: Record<string, string> = {
    default: "var(--royal)",
    green: "var(--success)",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        fontFamily: 'var(--font-inter), var(--font-noto)',
        fontWeight: 800,
        fontSize: 20,
        color: "var(--ink)",
        letterSpacing: "-0.01em",
        lineHeight: 1.25,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: iconBg[iconColor],
          color: iconFg[iconColor],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 15,
        }}
      >
        {icon}
      </span>
      {children}
    </div>
  );
}
