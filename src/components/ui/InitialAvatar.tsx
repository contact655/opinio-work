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
        /* ⚠★和文の頭文字（「山」「阪」など）が来るので `--font-noto` を後段に置く
              （2026-08-29）。Inter は和文グリフを持たないので、生の "Inter" だけだと
              和文がブラウザ既定の書体に落ち、同じ画面の他の和文と別の顔になる。
              `CompanyLogoImg` の頭文字も同じ形にしてある。 */
        fontFamily: "var(--font-inter), var(--font-noto)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initial}
    </div>
  );
}
