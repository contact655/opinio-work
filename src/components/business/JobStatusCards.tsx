"use client";
import Link from "next/link";
import type { JobStatusCounts } from "@/lib/business/dashboard";

/**
 * ★**すべての状態を数える**（2026-08-31 に `rejected` / `private` を足した）。
 *
 * ⚠️ それまでは `active + review + draft` だったので、
 *    **求人が全部取り下げられている企業に「求人がまだありません」と出る**状態だった
 *    （2026-08-31 時点で該当0社。**踏むのは1社目が全件取り下げられた日**）。
 *    CLAUDE.md「値が無いことを、ある値に置き換えない」。
 */
const totalJobs = (counts: JobStatusCounts) =>
  counts.active + counts.review + counts.draft + counts.rejected + counts.private;

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
      color: "var(--success-ink)",
      bg: "var(--success-soft)",
      /* ⚠️ `?status=` の値は `JOB_STATUS_TABS` の `status` と**同じ綴り**にする。
            旧: `active` / `review` は DB にも タブにも無い値で、`/biz/jobs` 側が
            知らない値として「すべて」に落としていた。 */
      href: "/biz/jobs?status=published",
    },
    {
      label: "審査中",
      subLabel: "In Review",
      count: counts.review,
      /* ⚠️ 数字は 28px なので基準は 3.0 だが、`--warm` は白の上で **2.15** で届かない。
            塗り（`bg`）は `--warm-soft` のままで、**文字だけ** `--warm-ink`(5.02)。 */
      color: "var(--warm-ink)",
      bg: "var(--warm-soft)",
      href: "/biz/jobs?status=pending_review",
    },
    {
      label: "下書き",
      subLabel: "Draft",
      count: counts.draft,
      color: "var(--ink-mute)",
      bg: "var(--line-soft)",
      href: "/biz/jobs?status=draft",
    },
    /* ★「差し戻し」「非公開」を足した（2026-08-31）。
          ⚠️ それまで3枚しか無く、**運営が取り下げた求人がダッシュボードに一切出なかった。**
             実測（2026-08-31 / 本番）: セールスフォースは求人5件のうち**3件が非公開**なのに、
             ダッシュボードは「公開中 2 / 審査中 0 / 下書き 0」としか出しておらず、
             **自社の求人が3件下ろされたことに企業が気づけなかった。**
          ⚠️ 件数（`closed`）は `getJobStatusCounts` が**元から計算していた**。
             **描いていなかっただけ。**
          ⚠️ 0件でも出す。`/biz/jobs` のタブが0件でも常に出るのと揃える
             （出したり消したりすると「なぜ増えたのか」が分からなくなる）。 */
    {
      label: "差し戻し",
      subLabel: "Rejected",
      count: counts.rejected,
      color: "var(--error)",
      bg: "var(--error-soft)",
      href: "/biz/jobs?status=rejected",
    },
    {
      label: "非公開",
      subLabel: "Unlisted",
      count: counts.private,
      color: "var(--ink)",
      bg: "var(--line-soft)",
      href: "/biz/jobs?status=private",
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
          fontFamily: "var(--font-inter), var(--font-noto)",
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
            <div style={{
              fontFamily: "var(--font-inter), var(--font-noto)",
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
