// SNS アイコンコンポーネント — ν-8 段階5 コミット B
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
  /** アイコンの一辺 px（デフォルト: 20） */
  size?: number;
}

/**
 * SNS ブランドアイコン。
 * SVG は /icons/sns/{platform}.svg を参照（public/ に同梱）。
 * aria-label には表示名（"X", "LinkedIn" 等）を設定。
 */
export function SocialIcon({ platform, size = 20 }: SocialIconProps) {
  const meta = SOCIAL_META[platform];
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
