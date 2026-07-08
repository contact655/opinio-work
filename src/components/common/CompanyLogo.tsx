"use client";

import { useState } from "react";
import { getLogoLetter } from "@/lib/utils/companyLogo";

// ─── Size tokens ──────────────────────────────────────────────────────────────
type SizeToken = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<SizeToken, { px: number; radius: number }> = {
  xs: { px: 24, radius: 5  },
  sm: { px: 36, radius: 7  },
  md: { px: 48, radius: 10 },
  lg: { px: 64, radius: 14 },
  xl: { px: 96, radius: 14 },
};

const DEFAULT_GRADIENT = "linear-gradient(135deg, var(--royal), #3B5FD9)";

// ─── Props ────────────────────────────────────────────────────────────────────
export interface CompanyLogoProps {
  /** DB の ow_companies.name — getLogoLetter のフォールバック計算に必須 */
  name: string;
  /** DB の ow_companies.logo_url（Clearbit URL 等）*/
  logoUrl?: string | null;
  /** DB の ow_companies.logo_letter */
  logoLetter?: string | null;
  /** DB の ow_companies.logo_gradient — フォールバック時の背景 */
  logoGradient?: string | null;
  /**
   * サイズ指定
   * - トークン: "xs"(24px) | "sm"(36px) | "md"(48px) | "lg"(64px) | "xl"(96px)
   * - 数値 px: 後方互換（borderRadius は自動計算）
   */
  size?: SizeToken | number;
  /** 角丸 px（数値 size 指定時のみ有効。トークン時は自動） */
  borderRadius?: number;
  style?: React.CSSProperties;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CompanyLogo({
  name,
  logoUrl,
  logoLetter,
  logoGradient,
  size = "md",
  borderRadius,
  style,
  className,
}: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);

  // サイズ解決
  let px: number;
  let radius: number;
  if (typeof size === "string") {
    const tok = SIZE_MAP[size] ?? SIZE_MAP.md;
    px = tok.px;
    radius = borderRadius ?? tok.radius;
  } else {
    px = size;
    radius = borderRadius ?? Math.round(px * 0.2);
  }

  // 頭文字: getLogoLetter が法人格プレフィックスを除去してくれる
  const letter = getLogoLetter(logoLetter, name);
  const gradient = logoGradient ?? DEFAULT_GRADIENT;
  const fontSize = Math.round(px * 0.38);

  const containerStyle: React.CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    borderRadius: radius,
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
  };

  const showImage = !!logoUrl && !imgError;

  if (showImage) {
    return (
      <div
        style={{ ...containerStyle, background: "#f8fafc", border: "1px solid var(--line)" }}
        className={className}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: Math.round(px * 0.08),
            boxSizing: "border-box",
            display: "block",
          }}
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
        fontFamily: "Inter, 'Noto Sans JP', sans-serif",
        fontWeight: 700,
        fontSize,
        letterSpacing: "-0.02em",
        userSelect: "none",
      }}
      className={className}
      aria-label={`${name} ロゴ`}
    >
      {letter}
    </div>
  );
}
