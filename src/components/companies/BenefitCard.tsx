"use client";

import React from "react";
import type { ChipVariant } from "@/lib/utils/chipVariant";
import type { Benefit } from "@/lib/companies/benefits";
import { splitParenSuffix } from "@/lib/utils/parenSuffix";
import { HoverNoteCard } from "./HoverNoteCard";

/**
 * 福利厚生の1枚。
 *
 * ── 補足は畳む（2026-09-02 / 柴さんの指示）──────────────────────────
 * `名前（補足）` の括弧内と `detail` は**常時表示しない**。ホバー／タップで出す。
 *
 * ⚠️★**スマホでは金額や条件がタップしないと読めない。** 実測（2026-09-02 / 29件）で
 *    **59%が括弧を持ち、中身は「月1万円まで」「週2出社」のような判断に効く値**。
 *    それを承知のうえでの判断（柴さん）。**「情報が消えている」ではなく
 *    「畳んである」ことが分かるよう、**開閉の印（シェブロン）は必ず出すこと。**
 *    ⚠️ 印は `ⓘ` から下向きシェブロンに変えた（2026-09-02 / 柴さん）。
 *       丸で囲んだ記号は**警告に見えてマイナスの印象を与える**という指摘。
 *
 * ⚠️ 常時表示だったころは、括弧を持つカードだけ 61px、持たないカードが 52px で
 *    **行の中で段差ができていた**（実測）。畳むと全カードが 52px に揃う。
 *
 * ── 仕組みは1つに寄せた ────────────────────────────────────
 * ⚠️ ホバー＋タップの実装は `HoverNoteCard` にある。**ここに書き直さないこと。**
 *    2026-09-02 まで同じ機構が `BenefitCard` と `HoverNoteCard` の2箇所にあった。
 */
export function BenefitCard({
  benefit, icon, variant,
}: {
  benefit: Benefit;
  icon: React.ReactNode;
  variant?: ChipVariant;
}) {
  const { name, sub } = splitParenSuffix(benefit.name);

  /* ⚠️ 括弧内と `detail` は**両方出す**。片方を捨てると、企業が入力したものが
        画面に出ないことになる（CLAUDE.md「入力させたのに表示しない」）。
        実測（2026-09-02 / 本番29件）では `detail` は0件で併用も0件だが、
        将来どちらも入ったときに落とさないようにしてある。 */
  const note = [sub, benefit.detail].filter(Boolean).join("\n") || null;

  return <HoverNoteCard icon={icon} label={name} note={note} variant={variant} />;
}
