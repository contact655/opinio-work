"use client";

import Link from "next/link";

// ─── 型 ──────────────────────────────────────────────────────────────────────

export type SidebarJob = {
  id: string;
  title: string;
  companyName: string;
  dept: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  workStyle: string | null;
  logoUrl: string | null;
  logoGradient: string;
  logoLetter: string;
};

export type SidebarPerson = {
  userId: string;
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;
  roleTitle: string | null;
  companyName: string;
};

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (v: number) => `${Math.round(v / 10000)}万円`;
  if (min && max) return `${fmt(min)}〜${fmt(max)}`;
  if (min) return `${fmt(min)}〜`;
  if (max) return `〜${fmt(max)}`;
  return null;
}

// ─── 求人ミニカード ────────────────────────────────────────────────────────────

function JobMiniCard({ job }: { job: SidebarJob }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);

  return (
    <Link
      href={`/jobs/${job.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: "#fff",
          transition: "box-shadow 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 2px 8px rgba(0,35,102,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* ロゴ */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: job.logoUrl ? undefined : job.logoGradient,
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {job.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.logoUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            job.logoLetter
          )}
        </div>

        {/* テキスト */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.title}
          </div>
          <div
            style={{
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 11,
              color: "var(--ink-soft)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.companyName}
          </div>
          {salary && (
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "var(--success)",
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              {salary}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── 人ミニカード ─────────────────────────────────────────────────────────────

function PersonMiniCard({ person }: { person: SidebarPerson }) {
  return (
    <Link
      href={`/u/${person.userId}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: "#fff",
          transition: "box-shadow 0.15s",
          cursor: "pointer",
          alignItems: "center",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 2px 8px rgba(0,35,102,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* アバター */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: person.avatarUrl ? undefined : person.gradient,
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {person.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            person.initial
          )}
        </div>

        {/* テキスト */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {person.name}
          </div>
          <div
            style={{
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 11,
              color: "var(--ink-soft)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {[person.roleTitle, person.companyName].filter(Boolean).join(" · ")}
          </div>
        </div>

        {/* 面談可バッジ */}
        <div
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 700,
            color: "var(--success)",
            background: "var(--success-soft)",
            border: "1px solid #a7f3d0",
            borderRadius: 100,
            padding: "2px 7px",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          話せる
        </div>
      </div>
    </Link>
  );
}

// ─── セクションヘッダー ────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: '"Noto Sans JP", sans-serif',
        fontSize: 12,
        fontWeight: 700,
        color: "var(--ink-soft)",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {label}
    </div>
  );
}

// ─── FeedSidebar（メイン） ────────────────────────────────────────────────────

export default function FeedSidebar({
  jobs,
  people,
}: {
  jobs: SidebarJob[];
  people: SidebarPerson[];
}) {
  const hasJobs = jobs.length > 0;
  const hasPeople = people.length > 0;

  if (!hasJobs && !hasPeople) return null;

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        position: "sticky",
        top: 100,
        alignSelf: "flex-start",
        paddingTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* 新着求人 */}
      {hasJobs && (
        <div>
          <SectionHeader label="新着求人" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {jobs.map((job) => (
              <JobMiniCard key={job.id} job={job} />
            ))}
          </div>
          <Link
            href="/jobs"
            style={{
              display: "block",
              textAlign: "right",
              marginTop: 10,
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 12,
              color: "var(--royal)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            求人をもっと見る →
          </Link>
        </div>
      )}

      {/* 話せる人 */}
      {hasPeople && (
        <div>
          <SectionHeader label="話せる人" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {people.map((person) => (
              <PersonMiniCard key={person.userId} person={person} />
            ))}
          </div>
          <Link
            href="/people"
            style={{
              display: "block",
              textAlign: "right",
              marginTop: 10,
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 12,
              color: "var(--royal)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            もっと見る →
          </Link>
        </div>
      )}
    </aside>
  );
}
