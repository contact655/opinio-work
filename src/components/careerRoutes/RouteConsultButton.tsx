"use client";

import { DMButton } from "@/components/profile/DMButton";
import { CAREER_GENERAL_KEY } from "@/lib/constants/careerConsult";
import { routeConsultNote } from "@/lib/constants/careerRoutes";

/**
 * ★転職ルートから相談を始めるボタン（2026-11-11 / 柴さんの決定）。
 *   既存のメッセージ（キャリア相談）を使い、次を下書きとして入れて開く。本人はすべて書き換えられる。
 *     聞きたい話 … キャリア全般 ／ 特に聞きたいこと … 転職の進め方 ／ ひとこと … 「（出発点）→（行き先）の転職について相談したいです」
 * ⚠️ 新しい相談のテーマは足さない（DB の CHECK を変えない）。
 * ⚠️ 相手とすでに会話があるときは、その会話を開く（下書きは入らない。DMButton の動き）。
 * ⚠️ 自分自身・送れない相手には DMButton がボタンを出さない。
 */
export function RouteConsultButton({ targetUserId, targetName, fromLabel, toLabel, variant = "block" }: {
  targetUserId: string;
  targetName: string;
  fromLabel: string;
  toLabel: string;
  variant?: "block" | "button";
}) {
  return (
    <DMButton
      targetUserId={targetUserId}
      targetName={targetName}
      label="相談を申し込む"
      variant={variant}
      consultPreset={{ about: CAREER_GENERAL_KEY, points: ["job_change"], note: routeConsultNote({ fromLabel, toLabel }) }}
    />
  );
}
