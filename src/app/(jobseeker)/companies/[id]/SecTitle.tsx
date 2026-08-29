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
  iconColor?: "default" | "green" | "purple" | "warm";
}) {
  const iconBg: Record<string, string> = {
    default: "var(--royal-50)",
    green: "var(--success-soft,#ECFDF5)",
    purple: "var(--purple-soft,#F3E8FF)",
    warm: "var(--warm-soft,#FEF3C7)",
  };
  const iconFg: Record<string, string> = {
    default: "var(--royal)",
    green: "var(--success)",
    purple: "var(--purple)",
    warm: "#B45309",
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
