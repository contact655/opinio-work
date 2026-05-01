"use client";
import Link from "next/link";
import type { JobStatusCounts } from "@/lib/business/dashboard";

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
    </section>
  );
}
