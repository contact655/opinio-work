"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  logoUrl: string;
  name: string;
  fallbackLetter: string;
  size?: number;
  gradient?: string;
};

/**
 * ロゴ画像表示コンポーネント
 * 画像読み込み失敗時（Clearbit 404等）は gradient + 頭文字にフォールバック
 */
export function CompanyLogoImage({ logoUrl, name, fallbackLetter, size = 96, gradient = "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)" }: Props) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <span style={{
        fontSize: size * 0.45,
        fontWeight: 800,
        color: "rgba(255,255,255,0.92)",
        letterSpacing: "-0.03em",
        fontFamily: "Inter, sans-serif",
      }}>
        {fallbackLetter}
      </span>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={name}
      width={size}
      height={size}
      style={{ objectFit: "contain", padding: 8 }}
      onError={() => setError(true)}
    />
  );
}
