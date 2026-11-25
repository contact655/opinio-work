"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { StoryViewObserver } from "@/components/views/StoryViewObserver";

export type CompanyUpdateItem = {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  text: string;
  /** 押したときの行き先（無ければリンクにしない） */
  href?: string | null;
  /** ★企業からの投稿だけ。押すとその場で本文を開く（投稿には別のページが無いため） */
  storyId?: string;
  body?: React.ReactNode;
};

export const UPDATES_INITIAL = 5;

/**
 * ★企業ページの「記事・更新情報」（2026-11-26 / 柴さんの指示）。企業からの投稿・取材記事・更新情報（募集開始など）を
 *   日付の新しい順に1本の一覧にする。1行＝「日付 ・ 内容」。5件まで出し、多ければ「もっと見る」でその場に開く。
 *
 * ⚠️ 企業からの投稿は本文がこのページでしか読めないので、行を押すと本文を開く（消さない）。
 *    開いた本文が画面に入ったら閲覧を数える（StoryViewObserver。それまでのカードと同じ数え方）。
 * ⚠️ 並べ替えはサーバー側（CompanyDetailPage）で済ませて渡す。
 */
export function CompanyUpdatesList({ items, countViews }: { items: CompanyUpdateItem[]; countViews: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (items.length === 0) return null;
  const shown = showAll ? items : items.slice(0, UPDATES_INITIAL);
  const toggle = (k: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  return (
    <div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {shown.map((it, i) => {
          const isOpen = open.has(it.key);
          const textStyle: React.CSSProperties = { fontSize: 14.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.6, overflowWrap: "anywhere" };
          return (
            <li key={it.key} data-update={it.key} style={{ padding: "12px 0", borderTop: i === 0 ? undefined : "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <time dateTime={it.date} style={{ flexShrink: 0, fontSize: 13, color: "var(--ink-mute)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {formatDate(it.date)}
                </time>
                <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                  {it.body ? (
                    <button type="button" onClick={() => toggle(it.key)} aria-expanded={isOpen}
                      style={{ ...textStyle, padding: 0, border: 0, background: "none", cursor: "pointer", textAlign: "left", color: "var(--royal)" }}>
                      {it.text}<span aria-hidden style={{ marginLeft: 6, fontSize: 12, color: "var(--ink-mute)" }}>{isOpen ? "▲" : "▼"}</span>
                    </button>
                  ) : it.href ? (
                    <Link href={it.href} className="hover:underline" style={{ ...textStyle, color: "var(--royal)", textDecoration: "none" }}>{it.text}</Link>
                  ) : (
                    <span style={textStyle}>{it.text}</span>
                  )}
                </span>
              </div>
              {it.body && isOpen && (
                <StoryViewObserver id={it.storyId ?? it.key} enabled={countViews && !!it.storyId}>
                  <div style={{ marginTop: 10, padding: "14px 16px", borderRadius: 10, background: "var(--bg-tint)" }}>{it.body}</div>
                </StoryViewObserver>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > UPDATES_INITIAL && !showAll && (
        <button type="button" onClick={() => setShowAll(true)} data-state="updates-more"
          style={{ marginTop: 8, padding: "8px 0", border: 0, background: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "var(--royal)" }}>
          もっと見る（残り{items.length - UPDATES_INITIAL}件）
        </button>
      )}
    </div>
  );
}

/** 2026-11-26 → 2026年11月26日。⚠️ 年月日の途中で折り返さない（time に nowrap） */
function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !day) return d;
  return `${y}年${m}月${day}日`;
}
