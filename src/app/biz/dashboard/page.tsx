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
  title: "ホーム | OPINIO Business",
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

      {/* ── Quick actions ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[
          {
            href: "/biz/jobs/new",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            ),
            label: "新規求人を作成",
            color: "var(--royal)",
            primary: true,
          },
          {
            href: "/biz/meetings",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            ),
            label: "面談を確認",
            color: "var(--ink-soft)",
            primary: false,
          },
          {
            href: "/biz/company",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            ),
            label: "企業情報を編集",
            color: "var(--ink-soft)",
            primary: false,
          },
          {
            href: "/biz/members",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            ),
            label: "メンバーを管理",
            color: "var(--ink-soft)",
            primary: false,
          },
        ].map(({ href, icon, label, color, primary }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: primary ? "10px 18px" : "10px 16px",
              background: primary ? "var(--royal)" : "#fff",
              border: `1px solid ${primary ? "var(--royal)" : "var(--line)"}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: primary ? "#fff" : color,
              textDecoration: "none",
              flexShrink: 0,
              transition: "opacity 0.15s",
            }}
          >
            {icon}
            {label}
          </Link>
        ))}
      </div>

      {/* ── Company card ── */}
      <CompanyCard
        tenantId={ctx.tenantId}
        tenantName={ctx.tenantName}
        logoGradient={ctx.logoGradient}
        logoLetter={ctx.logoLetter}
      />

      {/* ── Upgrade banner ── */}
      <UpgradeBanner />

      {/* ── Stat cards (4枚) ── */}
      <DashboardStatCards
        todoCounts={todoCounts}
        monthlyStats={monthlyStats}
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
        <MatchCandidates candidates={[]} />
      </div>

      {/* ── 2-col: JobStatusCards + TeamMembers ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 16,
      }}>
        <JobStatusCards counts={jobStatusCounts} />
        <TeamMembers members={teamMembers} />
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
