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
      <style>{`
        .setup-step-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 4px 12px rgba(0,35,102,0.08) !important;
        }
      `}</style>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid var(--line)",
        padding: 40,
        textAlign: "center",
        maxWidth: "var(--max-w-form)", margin: "60px auto",
      }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          企業アカウントを追加しますか？
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 22 }}>
          このアカウントには企業ロールが紐付いていません。<br />
          自社情報・求人を管理するには企業アカウントの追加申請が必要です。
        </p>
        <Link
          href="/biz/companies/add"
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

  // Determine if this is a "new" company with nothing set up yet
  const isNewCompany = jobStatusCounts.active === 0 && jobStatusCounts.draft === 0 && activities.length === 0;

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
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontWeight: 500, fontSize: 22,
            color: "var(--ink)", letterSpacing: "0.02em",
            margin: 0, marginBottom: 2,
          }}>
            {greeting}、{greetingName}さん。
          </h1>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 11, color: "var(--ink-mute)", fontWeight: 500,
          }}>
            {today}
          </span>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/biz/jobs/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px",
              background: "var(--royal)",
              border: "1px solid var(--royal)",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: "#fff", textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新規求人を作成
          </Link>
          {[
            { href: "/biz/meetings", label: "面談" },
            { href: "/biz/candidates", label: "候補者" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 14px", background: "#fff",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none",
            }}>
              {label}
            </Link>
          ))}
        </div>
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

      {/* ── Getting Started (新規企業のみ) ── */}
      {isNewCompany && (
        <div style={{
          background: "linear-gradient(135deg, #EFF3FC 0%, #F8FAFC 100%)",
          border: "1px solid var(--royal-100)",
          borderRadius: 14,
          padding: "22px 26px",
          marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--royal)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>
                スタートアップガイド
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                以下のステップで求人掲載を開始しましょう
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              {
                step: "1",
                title: "企業情報を完成させる",
                desc: "ミッション・写真・カルチャーを入力",
                href: "/biz/company",
                done: false,
              },
              {
                step: "2",
                title: "求人を作成・公開する",
                desc: "審査後 OPINIO に掲載されます",
                href: "/biz/jobs/new",
                done: false,
              },
              {
                step: "3",
                title: "カジュアル面談を受け付ける",
                desc: "候補者からの申込が届き始めます",
                href: "/biz/company",
                done: false,
              },
            ].map(({ step, title, desc, href }) => (
              <Link key={step} href={href} className="setup-step-card" style={{
                display: "block", textDecoration: "none",
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 10, padding: "14px 16px",
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "var(--royal-50)", color: "var(--royal)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, marginBottom: 8,
                }}>
                  {step}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {title}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.5 }}>
                  {desc}
                </div>
                <div style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, marginTop: 8 }}>
                  設定する →
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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

      {/* ── Match candidates ── */}
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
