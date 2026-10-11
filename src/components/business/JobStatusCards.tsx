"use client";
import Link from "next/link";
import type { JobStatusCounts } from "@/lib/business/dashboard";
import { DashboardCardHeading } from "./DashboardCardHeading";

/**
 * ★**すべての状態を数える**（2026-08-31 に `rejected` / `private` を足した）。
 *
 * ⚠️ それまでは `active + review + draft` だったので、
 *    **求人が全部取り下げられている企業に「求人がまだありません」と出る**状態だった
 *    （2026-08-31 時点で該当0社。**踏むのは1社目が全件取り下げられた日**）。
 *    CLAUDE.md「値が無いことを、ある値に置き換えない」。
 */
const totalJobs = (counts: JobStatusCounts) => counts.published + counts.draft + counts.stopped;

type Props = { counts: JobStatusCounts };

type Card = {
  label: string;
  count: number;
  color: string;
  bg: string;
  href: string;
};

export function JobStatusCards({ counts }: Props) {
  /* ★2026-10-12 に3枚にした（下書き／公開中／停止中。lib/jobs/jobState.ts）。
        「運営確認中」「非公開」は無くした。⚠️ `?status=` は求人管理のタブの値（published / draft / stopped）。
     ⚠️ 0件でも出す（求人管理のタブと揃える） */
  const cards: Card[] = [
    { label: "公開中", count: counts.published, color: "var(--success-ink)", bg: "var(--success-soft)", href: "/biz/jobs?status=published" },
    { label: "下書き", count: counts.draft, color: "var(--ink-mute)", bg: "var(--line-soft)", href: "/biz/jobs?status=draft" },
    { label: "停止中", count: counts.stopped, color: "var(--ink)", bg: "var(--line-soft)", href: "/biz/jobs?status=stopped" },
  ];

  return (
    <section style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <DashboardCardHeading title="求人" link={{ href: "/biz/jobs", label: "求人管理" }} />

      {totalJobs(counts) === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 16px" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "var(--success-soft)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round">
              <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
            求人がまだありません
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 14 }}>
            求人を公開して応募を集めましょう
          </div>
          <Link
            href="/biz/jobs/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 16px", borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              background: "var(--success-soft)", color: "var(--success-ink)",
              border: "1px solid #A7F3D0", textDecoration: "none",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            求人を作成する →
          </Link>
        </div>
      ) : (
      /* ⚠️ 5枚になったので `repeat(3, 1fr)` 固定をやめる。狭い幅で2列・1列に落ちる */
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: 10 }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{
            display: "block", textDecoration: "none",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "14px 16px",
            transition: "border-color 0.15s, background 0.15s",
          }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = c.color;
              (e.currentTarget as HTMLAnchorElement).style.background = c.bg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line)";
              (e.currentTarget as HTMLAnchorElement).style.background = "#fff";
            }}
          >
            <div style={{
              fontFamily: "var(--font-inter), var(--font-noto)",
              fontSize: 28, fontWeight: 700, color: c.color,
              lineHeight: 1, marginBottom: 6,
            }}>
              {c.count}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
              {c.label}
            </div>
          </Link>
        ))}
      </div>
      )}
    </section>
  );
}
