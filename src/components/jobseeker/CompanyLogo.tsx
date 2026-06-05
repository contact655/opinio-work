import Image from "next/image";

// ─── Size tokens ──────────────────────────────────────────────────────────────
// Avatar.tsx と同じトークン名で統一。numeric size も引き続きサポート（後方互換）。

type SizeToken = "sm" | "md" | "lg";

const SIZE_TOKENS: Record<SizeToken, { px: number; borderRadius: number }> = {
  sm: { px: 28, borderRadius: 6 },
  md: { px: 40, borderRadius: 8 },
  lg: { px: 56, borderRadius: 10 },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CompanyLogoProps {
  /** 会社名。フォールバック時の頭文字取得に使用 */
  name: string;
  /** 直接ロゴ URL（Storage / CDN）。優先度最高 */
  logoUrl?: string | null;
  /** ロゴ文字（logo_letter カラム）。null 時は name の先頭文字にフォールバック */
  logoLetter?: string | null;
  /** ロゴ背景グラデーション（logo_gradient カラム）。null 時は royal blue */
  logoGradient?: string | null;
  /**
   * サイズ指定。
   * - トークン: "sm"(28px) | "md"(40px) | "lg"(56px)
   * - 数値 px: 後方互換のため引き続きサポート（borderRadius は自動計算）
   */
  size?: SizeToken | number;
  /** 角丸 px。数値 size 指定時のみ有効。トークン指定時は自動決定 */
  borderRadius?: number;
}

const DEFAULT_GRADIENT = "linear-gradient(135deg, var(--royal), #3B5FD9)";

// ─── Component ────────────────────────────────────────────────────────────────

export function CompanyLogo({
  name,
  logoUrl,
  logoLetter,
  logoGradient,
  size = "md",
  borderRadius,
}: CompanyLogoProps) {
  // size がトークンなら対応 px / borderRadius を使用、数値なら数値のまま使用
  let px: number;
  let radius: number;

  if (typeof size === "string") {
    const token = SIZE_TOKENS[size] ?? SIZE_TOKENS.md;
    px = token.px;
    radius = borderRadius ?? token.borderRadius;
  } else {
    px = size;
    // 数値 size のデフォルト角丸: サイズに比例して自然な値（既存の動作を維持）
    radius = borderRadius ?? Math.round(px * 0.2);
  }

  const letter = logoLetter ?? name.charAt(0).toUpperCase();
  const gradient = logoGradient ?? DEFAULT_GRADIENT;
  const fontSize = Math.round(px * 0.38);

  const containerStyle: React.CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    borderRadius: radius,
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (logoUrl) {
    return (
      <div style={containerStyle}>
        <Image
          src={logoUrl}
          alt={`${name} ロゴ`}
          width={px}
          height={px}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...containerStyle,
        background: gradient,
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        fontSize,
        letterSpacing: "-0.02em",
      }}
      aria-label={`${name} ロゴ`}
    >
      {letter}
    </div>
  );
}
