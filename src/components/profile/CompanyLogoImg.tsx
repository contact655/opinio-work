"use client";

/**
 * CompanyLogoImg — 一覧カード・フィード・タイムラインなど、小さめの企業ロゴを出す共通部品。
 *
 * ⚠️ 企業ロゴを出す画面はここを通すこと。生の <img src={logo_url}> を各所に書かない。
 *    2026-08-05 に Clearbit が死んだとき、経路がばらけていたせいで
 *    「どこが壊れているか数える」ところから始めることになった。判定は1箇所に置く。
 *
 * フォールバックは3段階:
 *   1. 使える logo_url がある      → <img>。読み込み失敗（onError / naturalWidth 0）で 2 へ
 *   2. logo_letter + logo_gradient → 文字の四角
 *   3. logo_letter が無い           → name から getLogoLetter で作る
 *
 * ⚠️ 死んでいると分かっている URL（isDeadLogoUrl）は **リクエストすら出さない**。
 *    onError 頼みだと、76社ぶんの必ず失敗するリクエストが毎回飛ぶ。
 *
 * 大きいロゴ（企業詳細のヒーロー等）は @/components/common/CompanyLogo を使う。
 * あちらは Google favicon への切り替えまでやる重い版。
 */

import { useState } from "react";
import { getLogoLetter, usableLogoUrl } from "@/lib/utils/companyLogo";

type CompanyLogoImgProps = {
  logoUrl: string | null | undefined;
  logoLetter: string | null;
  logoGradient: string | null;
  /** logo_letter が無いときに頭文字を作る元。ow_companies.name を渡す */
  name?: string | null;
  /** アイコンのサイズ（px）。デフォルト 36 */
  size?: number;
  /** 角丸。既定は size * 0.2 */
  borderRadius?: number;
};

export default function CompanyLogoImg({
  logoUrl,
  logoLetter,
  logoGradient,
  name,
  size = 36,
  borderRadius,
}: CompanyLogoImgProps) {
  const [broken, setBroken] = useState(false);
  const src = usableLogoUrl(logoUrl);
  const letter = logoLetter ?? (name ? getLogoLetter(null, name) : null);
  const radius = borderRadius ?? size * 0.2;

  // 使える URL が無い / ロード失敗 → 文字の四角
  if (!src || broken) {
    return <LetterCircle letter={letter} gradient={logoGradient} size={size} borderRadius={radius} />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        flexShrink: 0,
        background: logoGradient ?? "var(--ink-mute)",
        position: "relative",
      }}
    >
      {/* letter は img の下に敷く（img が透過・途中失敗しても穴が空かない） */}
      {letter && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          /* ⚠️ 端数を出さない（2026-08-30）。`size * 0.42` は 38px のとき
                15.959999999999999px になり、実測でその1種類だけ他と揃わなかった。
                `components/ui/InitialAvatar.tsx` は元から `Math.round` している。 */
            fontSize: Math.round(size * 0.42),
            fontWeight: 700,
          }}
        >
          {letter}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        // 読み込めたのに中身が空（naturalWidth 0）のケースも落とす
        onLoad={(e) => { if (e.currentTarget.naturalWidth === 0) setBroken(true); }}
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

/** logo_url が使えないときの文字の四角 */
export function LetterCircle({
  letter,
  gradient,
  size = 36,
  borderRadius,
}: {
  letter: string | null;
  gradient: string | null;
  size?: number;
  borderRadius?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius ?? size * 0.2,
        background: gradient ?? "linear-gradient(135deg, #001233, #002366)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#fff",
        /* ⚠️ 端数を出さない（上と同じ理由） */
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        /* ⚠★`"var(--font-inter), var(--font-noto)"` にしない（2026-08-29）。ここに来るのは
              **企業名・学校名の頭文字**で、「阪」「滝」のような**和文が入る。**
              Inter は和文グリフを持たないので、和文だけブラウザ既定の書体に落ち、
              同じ画面の他の和文と別の顔になる。 */
        fontFamily: "var(--font-inter), var(--font-noto)",
      }}
    >
      {letter ?? ""}
    </div>
  );
}
