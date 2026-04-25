import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg" | "xl";
type AvatarGradient = "royal" | "green" | "pink" | "purple" | "cyan" | "orange";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  gradient?: AvatarGradient | string;
  className?: string;
}

const SIZES: Record<AvatarSize, { px: number; fontSize: number }> = {
  sm: { px: 28, fontSize: 11 },
  md: { px: 36, fontSize: 13 },
  lg: { px: 52, fontSize: 20 },
  xl: { px: 72, fontSize: 28 },
};

const GRADIENTS: Record<AvatarGradient, string> = {
  royal:  "linear-gradient(135deg, #002366, #3B5FD9)",
  green:  "linear-gradient(135deg, #059669, #047857)",
  pink:   "linear-gradient(135deg, #DB2777, #BE185D)",
  purple: "linear-gradient(135deg, #A78BFA, #7C3AED)",
  cyan:   "linear-gradient(135deg, #22D3EE, #0891B2)",
  orange: "linear-gradient(135deg, #F97316, #EA580C)",
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ name, src, size = "md", gradient = "royal", className }: AvatarProps) {
  const { px, fontSize } = SIZES[size as AvatarSize] ?? SIZES.md;
  const bg = GRADIENTS[gradient as AvatarGradient] ?? gradient;

  const base: React.CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  };

  if (src) {
    return (
      <div style={base} className={className}>
        <Image
          src={src}
          alt={name}
          width={px}
          height={px}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{ ...base, background: bg, color: "#fff", fontSize, fontWeight: 600, letterSpacing: "-0.01em" }}
      className={className}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
