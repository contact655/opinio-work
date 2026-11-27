import type React from "react";
import { SectionTitle } from "@/components/detail/SectionTitle";

/**
 * ★企業詳細・募集詳細の本文のカード（2026-11-26 / 柴さんの指示。2ページ共通）。
 *   角丸14px・線は1px（--line ＝ slate-200）・影なし。見出しは SectionTitle（h2・18px）。
 *   セクションごとに1枚。カードどうしの間隔は呼び出し側の並べ方（.dt-stack）が持つ。
 *
 * ⚠️ 中身が無いセクションは呼び出し側で描かないこと（空のカードを出さない）。
 * ⚠️ 左右の余白は --cd-pad-x（globals.css の .cd-body）。企業ページのセクション（.cd-sec）と同じ値。
 */
export function SectionCard({ id, state, title, children }: {
  id?: string;
  state?: string;
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-state={state} className="jd-card dt-card">
      {title && <SectionTitle style={{ marginBottom: 14 }}>{title}</SectionTitle>}
      {children}
    </section>
  );
}
