"use client";

/**
 * イニシャル円アバター — 共通コンポーネント
 *
 * JobseekerHeader・メッセージ詳細画面で共用する。
 * - self (ログイン中ユーザー): デフォルト（royal グラデーション、白テキスト）
 * - other (相手方): bgStyle / textColor を明示的に渡して視覚的に区別する
 */
type InitialAvatarProps = {
  /** 表示名。先頭 1 文字を大文字で表示する */
  name: string;
  /** 直径（px）。デフォルト 32 */
  size?: number;
  /** CSS background 値。デフォルト = royal グラデーション */
  bgStyle?: string;
  /** テキストカラー。デフォルト = #fff */
  textColor?: string;
};

export function InitialAvatar({
  name,
  size = 32,
  bgStyle = "linear-gradient(135deg, var(--royal), var(--accent))",
  textColor = "#fff",
}: InitialAvatarProps) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bgStyle,
        color: textColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.41),
        fontWeight: 700,
        fontFamily: "'Inter', sans-serif",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initial}
    </div>
  );
}
