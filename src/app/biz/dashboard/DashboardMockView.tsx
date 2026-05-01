import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyCard } from "@/components/business/CompanyCard";
import { DashboardStatCards } from "@/components/business/DashboardStatCards";
import { JobPerformanceList } from "@/components/business/JobPerformanceList";
import { UpgradeBanner } from "@/components/business/UpgradeBanner";
import { EditorInvitation } from "@/components/business/EditorInvitation";
import { PendingMeetings } from "@/components/business/PendingMeetings";
import { ActivityList } from "@/components/business/ActivityList";
import { MatchCandidates } from "@/components/business/MatchCandidates";
import { JobStatusCards } from "@/components/business/JobStatusCards";
import { TeamMembers } from "@/components/business/TeamMembers";
import { RecruiterProfile } from "@/components/business/RecruiterProfile";
import {
  mockTenantContext,
  mockTodoCounts,
  mockMonthlyStats,
  mockJobStatusCounts,
  mockJobPerformance,
  mockPendingMeetings,
  mockActivities,
  mockMatchCandidates,
  mockTeamMembers,
  mockRecruiterProfile,
} from "@/lib/business/mockTenantContext";

function getGreeting(hour: number): string {
  if (hour < 12) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "おかえりなさい";
}

export function DashboardMockView() {
  const ctx = mockTenantContext;
  const hour = new Date().getHours();
  const greeting = getGreeting(hour);
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  const greetingName = ctx.userName.includes(" ")
    ? ctx.userName.split(" ").slice(-1)[0]
    : ctx.userName;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      planType={ctx.planType}
    >
      {/* ── Dev mock banner ── */}
      <div style={{
        marginBottom: 20,
        padding: "10px 16px",
        background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>🧪</span>
          <div>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10, fontWeight: 700,
              color: "rgba(255,255,255,0.7)", letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginRight: 8,
            }}>
              Development Mode
            </span>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>
              モックデータを表示中。本番では実テナントのデータに切り替わります。
            </span>
          </div>
        </div>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10, fontWeight: 700,
          padding: "3px 10px", borderRadius: 100,
          background: "rgba(255,255,255,0.15)",
          color: "#fff", whiteSpace: "nowrap",
        }}>
          NEXT_PUBLIC_BIZ_MOCK_MODE=true
        </span>
      </div>

      {/* ── Greeting header ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 24,
      }}>
        <h1 style={{
          fontFamily: "var(--font-noto-serif)",
          fontWeight: 500, fontSize: 24,
          color: "var(--ink)", letterSpacing: "0.02em",
          margin: 0,
        }}>
          {greeting}、{greetingName}さん。
        </h1>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12, color: "var(--ink-mute)", fontWeight: 500,
        }}>
          {today}
        </span>
      </div>

      {/* ── Company card ── */}
      <CompanyCard
        tenantId={ctx.tenantId}
        tenantName={ctx.tenantName}
        logoGradient={ctx.logoGradient}
        logoLetter={ctx.logoLetter}
        planType={ctx.planType}
      />

      {/* ── Upgrade banner (free plan only) ── */}
      <UpgradeBanner planType={ctx.planType} />

      {/* ── Stat cards (4枚) ── */}
      <DashboardStatCards
        todoCounts={mockTodoCounts}
        monthlyStats={mockMonthlyStats}
        planType={ctx.planType}
        activeJobCount={mockJobStatusCounts.active}
      />

      {/* ── Editor invitation ── */}
      <EditorInvitation />

      {/* ── 2-col: PendingMeetings + ActivityList ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 4,
      }}>
        <PendingMeetings meetings={mockPendingMeetings} />
        <ActivityList activities={mockActivities} />
      </div>

      {/* ── Match candidates ── */}
      <div style={{ marginTop: 16 }}>
        <MatchCandidates candidates={mockMatchCandidates} planType={ctx.planType} />
      </div>

      {/* ── 2-col: JobStatusCards + TeamMembers ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 16,
      }}>
        <JobStatusCards counts={mockJobStatusCounts} />
        <TeamMembers members={mockTeamMembers} planType={ctx.planType} />
      </div>

      {/* ── Recruiter profile widget ── */}
      <div style={{ marginTop: 16 }}>
        <RecruiterProfile profile={mockRecruiterProfile} />
      </div>

      {/* ── Job performance ── */}
      <section style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "22px 26px",
        marginTop: 16,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
        }}>
          <div style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: 15, fontWeight: 600, color: "var(--ink)",
            display: "flex", alignItems: "baseline", gap: 8,
          }}>
            求人パフォーマンス
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9, fontWeight: 700,
              color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
            }}>Job Performance</span>
          </div>
          <Link href="/biz/jobs" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
            求人管理へ →
          </Link>
        </div>
        <JobPerformanceList jobs={mockJobPerformance} />
      </section>
    </BusinessLayout>
  );
}
