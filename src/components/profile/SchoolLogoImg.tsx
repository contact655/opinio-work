"use client";

/**
 * SchoolLogoImg — MergedTimeline の学歴アイコン用ロゴコンポーネント
 *
 * CompanyLogoImg の学歴側対応版。`LetterCircle` named export を再利用。
 *
 * 3 段階フォールバック（段階6-6 判断点 #8）:
 *   1. schoolMaster.logo_url あり → <img> ロゴ表示（onError でステップ 2 へ）
 *   2. logo_url なし or ロード失敗 + logo_letter あり → LetterCircle（letter + gradient 円）
 *   3. schoolMaster 全体が null or logo_letter なし → <GraduationCap>（従来フォールバック）
 *
 * 判断点まとめ:
 *   #7: type=graduate_school も university と同じ見た目（分岐なし）
 *   #8: フォールバック順序は CompanyLogoImg に準拠
 *   #9: EducationIcon を完全置換（GraduationCap を内包）
 *   #10: isCurrent 強調なし（色変化なし、var(--ink-mute) 固定）
 *   #11: サイズ 40px（CompanyLogoImg と同じ）
 *
 * school_id が null の既存データ → schoolMaster が null → GraduationCap（漸進的移行、段階6-6 判断点 #5）
 * Phase 5 で EducationEditor からマスター選択 → school_id 設定 → LetterCircle 表示に切り替わる
 */

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { LetterCircle } from "./CompanyLogoImg";

type SchoolMasterLike = {
  logo_url: string | null;
  logo_letter: string | null;
  logo_gradient: string | null;
};

type Props = {
  schoolMaster: SchoolMasterLike | null;
  /** アイコン円のサイズ（px）。デフォルト 40 */
  size?: number;
};

export default function SchoolLogoImg({ schoolMaster, size = 40 }: Props) {
  const [broken, setBroken] = useState(false);

  // ── ステップ 3: schoolMaster 全体が null（既存データ・フリーテキスト入力）──
  if (!schoolMaster) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-mute)",
        }}
      >
        <GraduationCap size={size * 0.5} />
      </div>
    );
  }

  // ── ステップ 1: logo_url あり + 未破損 ──
  if (schoolMaster.logo_url && !broken) {
    return (
      <img
        src={schoolMaster.logo_url}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.2,
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }

  // ── ステップ 2: logo_letter + logo_gradient の円 ──
  if (schoolMaster.logo_letter) {
    return (
      <LetterCircle
        letter={schoolMaster.logo_letter}
        gradient={schoolMaster.logo_gradient}
        size={size}
      />
    );
  }

  // ── ステップ 3: letter もない → GraduationCap ──
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-mute)",
      }}
    >
      <GraduationCap size={size * 0.5} />
    </div>
  );
}
