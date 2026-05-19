"use client";

/**
 * CompanyLogoImg — MergedTimeline のアイコン円 / カード内小ロゴ用画像コンポーネント
 *
 * onError が Client Component を必要とするため分離（Server Component の MergedTimeline からは
 * FutureSectionEditor と同じパターンで import する）。
 *
 * 3 段階フォールバック（A-1 判断 C/D）:
 *   1. logo_url あり → <img> ロゴ表示
 *   2. logo_url なし または ロード失敗 → logo_letter + logo_gradient 円
 *   3. logo_letter/logo_gradient なし → 呼び出し元の Briefcase アイコン（このコンポーネントは null を返す）
 */

import { useState } from "react";

type CompanyLogoImgProps = {
  logoUrl: string;
  logoLetter: string | null;
  logoGradient: string | null;
  /** アイコン円のサイズ（px）。デフォルト 36 */
  size?: number;
};

export default function CompanyLogoImg({
  logoUrl,
  logoLetter,
  logoGradient,
  size = 36,
}: CompanyLogoImgProps) {
  const [broken, setBroken] = useState(false);

  // ロード失敗 → ステップ 2（letter+gradient 円）へフォールバック
  if (broken) {
    return (
      <LetterCircle
        letter={logoLetter}
        gradient={logoGradient}
        size={size}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        overflow: "hidden",
        flexShrink: 0,
        background: logoGradient ?? "var(--ink-mute)",
        position: "relative",
      }}
    >
      {/* letter circle は img の下に重ねる（img が透過/失敗したときに見える） */}
      {logoLetter && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: size * 0.42,
            fontWeight: 700,
          }}
        >
          {logoLetter}
        </div>
      )}
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}

/** ステップ 2: logo_letter + logo_gradient の円（logo_url なし / ロード失敗時） */
export function LetterCircle({
  letter,
  gradient,
  size = 36,
}: {
  letter: string | null;
  gradient: string | null;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: gradient ?? "var(--ink-mute)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#fff",
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {letter ?? ""}
    </div>
  );
}
