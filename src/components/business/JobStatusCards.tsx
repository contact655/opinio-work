"use client";
import Link from "next/link";
import type { JobStatusCounts } from "@/lib/business/dashboard";

const totalJobs = (counts: JobStatusCounts) => counts.active + counts.review + counts.draft;

type Props = { counts: JobStatusCounts };

type Card = {
  label: string;
  subLabel: string;
  count: number;
  color: string;
  bg: string;
  href: string;
};

export function JobStatusCards({ counts }: Props) {
  const cards: Card[] = [
    {
      label: "公開中",
      subLabel: "Active",
      count: counts.active,
      color: "var(--success)",
      bg: "var(--success-soft)",
      href: "/biz/jobs?status=active",
    },
    {
      label: "審査中",
      subLabel: "In Review",
      count: counts.review,
      color: "var(--warm)",
      bg: "var(--warm-soft)",
      href: "/biz/jobs?status=review",
    },
    {
      label: "下書き",
      subLabel: "Draft",
      count: counts.draft,
      color: "var(--ink-mute)",
      bg: "var(--line-soft)",
      href: "/biz/jobs?status=draft",
    },
  ];

  return (
    <section style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <div style={{
        fontFamily: "var(--font-noto-serif)",
        fontSize: 15, fontWeight: 600, color: "var(--ink)",
        display: "flex", alignItems: "baseline", gap: 8,
        marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
      }}>
        求人ステータス
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 9, fontWeight: 700,
          color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
        }}>Job Status</span>
      </div>

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
              background: "var(--success-soft)", color: "var(--success)",
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
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
              fontFamily: "'Inter', sans-serif",
              fontSize: 28, fontWeight: 700, color: c.color,
              lineHeight: 1, marginBottom: 6,
            }}>
              {c.count}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
              {c.label}
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9, fontWeight: 700,
              color: "var(--ink-mute)", letterSpacing: "0.12em", textTransform: "uppercase",
            }}>
              {c.subLabel}
            </div>
          </Link>
        ))}
      </div>
      )}
    </section>
  );
}
