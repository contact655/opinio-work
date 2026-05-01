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
// RecruiterProfile: S1c で ow_users 接続後に有効化
import { DashboardMockView } from "./DashboardMockView";
import {
  getTenantContext,
  getTodoCounts,
  getMonthlyStats,
  getJobPerformance,
  getJobStatusCounts,
} from "@/lib/business/dashboard";
import { fetchActivitiesForDashboard } from "@/lib/business/activities";
import { fetchTeamMembersForDashboard } from "@/lib/business/team";
import { fetchPendingMeetingsForDashboard } from "@/lib/business/meetings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ダッシュボード | Opinio Business",
};

function getGreeting(hour: number): string {
  if (hour < 12) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "おかえりなさい";
}

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid var(--line)",
        padding: 40,
        textAlign: "center",
        maxWidth: "var(--max-w-form)", margin: "60px auto",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏢</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          企業アカウントを追加しますか？
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 22 }}>
          このアカウントには企業ロールが紐付いていません。<br />
          自社情報・求人を管理するには企業アカウントの追加申請が必要です。
        </p>
        <Link
          href="/biz/auth/signup"
          style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            background: "var(--royal)", color: "#fff", textDecoration: "none",
          }}
        >
          企業アカウントを追加 →
        </Link>
        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ fontSize: 12, color: "var(--ink-mute)", textDecoration: "underline" }}>
            候補者サイトに戻る
          </Link>
        </div>
      </div>
    </BusinessLayout>
  );
}

export default async function BizDashboardPage() {
  const ctx = await getTenantContext();

  if (!ctx) {
    // NEXT_PUBLIC_BIZ_MOCK_MODE=true の場合のみモックで描画（dev 専用）
    if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
      return <DashboardMockView />;
    }
    return <NoTenantPage />;
  }

  const supabase = createClient();
  const [todoCounts, monthlyStats, jobPerformance, jobStatusCounts, pendingMeetings, activities, teamMembers] = await Promise.all([
    getTodoCounts(ctx.tenantId),
    getMonthlyStats(ctx.tenantId),
    getJobPerformance(ctx.tenantId),
    getJobStatusCounts(ctx.tenantId),
    fetchPendingMeetingsForDashboard(supabase, ctx.tenantId),
    fetchActivitiesForDashboard(supabase, ctx.tenantId),
    fetchTeamMembersForDashboard(supabase, ctx.tenantId),
  ]);

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
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
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
        todoCounts={todoCounts}
        monthlyStats={monthlyStats}
        planType={ctx.planType}
        activeJobCount={jobStatusCounts.active}
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
        <PendingMeetings meetings={pendingMeetings} />
        <ActivityList activities={activities} />
      </div>

      {/* ── Match candidates (Supabase なし → 空ロック状態) ── */}
      <div style={{ marginTop: 16 }}>
        <MatchCandidates candidates={[]} planType={ctx.planType} />
      </div>

      {/* ── 2-col: JobStatusCards + TeamMembers ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 16,
      }}>
        <JobStatusCards counts={jobStatusCounts} />
        <TeamMembers members={teamMembers} planType={ctx.planType} />
      </div>

      {/* ── Recruiter profile widget ── */}
      {/* S1c: RecruiterProfile は ow_users から実装予定 */}

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
        <JobPerformanceList jobs={jobPerformance} />
      </section>
    </BusinessLayout>
  );
}
