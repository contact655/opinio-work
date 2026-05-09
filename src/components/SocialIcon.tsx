// SNS アイコンコンポーネント — ν-8 段階5 コミット B / D'
// 7種固定: twitter(X) / linkedin / github / instagram / facebook / youtube / note
// SVG は public/icons/sns/ に同梱。キー名は JSONB キー（twitter = X）と一致。

export type SocialPlatform =
  | "twitter"
  | "linkedin"
  | "github"
  | "instagram"
  | "facebook"
  | "youtube"
  | "note";

export const SOCIAL_META: Record<
  SocialPlatform,
  { label: string; color: string; placeholder: string }
> = {
  twitter:   { label: "X",         color: "#000000", placeholder: "https://x.com/yourname" },
  linkedin:  { label: "LinkedIn",  color: "#0A66C2", placeholder: "https://www.linkedin.com/in/yourname" },
  github:    { label: "GitHub",    color: "#181717", placeholder: "https://github.com/yourname" },
  instagram: { label: "Instagram", color: "#E4405F", placeholder: "https://www.instagram.com/yourname" },
  facebook:  { label: "Facebook",  color: "#1877F2", placeholder: "https://www.facebook.com/yourname" },
  youtube:   { label: "YouTube",   color: "#FF0000", placeholder: "https://www.youtube.com/@yourname" },
  note:      { label: "note",      color: "#41C9B4", placeholder: "https://note.com/yourname" },
};

/** JSONB に保存する順序（表示順も兼ねる） */
export const SNS_PLATFORMS: SocialPlatform[] = [
  "twitter",
  "linkedin",
  "github",
  "instagram",
  "facebook",
  "youtube",
  "note",
];

interface SocialIconProps {
  platform: SocialPlatform;
  /**
   * "icon"（デフォルト）: <img> のみ。編集 UI での inline 使用向け。
   * "display": ブランドカラー背景 38×38px の正方形ブロック。公開ページ向け。
   *   - note 以外: 背景 = ブランドカラー、アイコン = 白（CSS filter）
   *   - note: SVG 自体に色背景があるため背景なしで SVG を fill
   *   css クラス "sns-icon-link" と組み合わせて hover を globals.css で定義。
   */
  variant?: "icon" | "display";
  /** variant="icon" のときのアイコン一辺 px（デフォルト: 20） */
  size?: number;
}

/**
 * SNS ブランドアイコン。
 * SVG は /icons/sns/{platform}.svg を参照（public/ に同梱）。
 * aria-label には表示名（"X", "LinkedIn" 等）を設定。
 */
export function SocialIcon({ platform, size = 20, variant = "icon" }: SocialIconProps) {
  const meta = SOCIAL_META[platform];

  // ── display variant: ブランドカラー背景 + アイコン ──────────────────────
  if (variant === "display") {
    // note SVG は自身にブランドカラー rect を持つため背景不要
    if (platform === "note") {
      return (
        <span
          style={{
            width: 38, height: 38,
            borderRadius: 10,
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/sns/note.svg"
            alt=""
            aria-label="note"
            width={38}
            height={38}
            style={{ display: "block" }}
          />
        </span>
      );
    }

    // その他 6 種: ブランドカラー背景 + 白アイコン
    return (
      <span
        style={{
          width: 38, height: 38,
          borderRadius: 10,
          background: meta.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/icons/sns/${platform}.svg`}
          alt=""
          aria-label={meta.label}
          width={22}
          height={22}
          style={{ display: "block", filter: "brightness(0) invert(1)" }}
        />
      </span>
    );
  }

  // ── icon variant（デフォルト）: <img> のみ ──────────────────────────────
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/sns/${platform}.svg`}
      alt=""
      aria-label={meta.label}
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}
