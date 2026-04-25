import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyCard } from "@/components/business/CompanyCard";
import { DashboardStatCards } from "@/components/business/DashboardStatCards";
import { JobPerformanceList } from "@/components/business/JobPerformanceList";
import {
  getTenantContext,
  getTodoCounts,
  getMonthlyStats,
  getJobPerformance,
  getJobStatusCounts,
} from "@/lib/business/dashboard";
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
        maxWidth: 560, margin: "60px auto",
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
  if (!ctx) return <NoTenantPage />;

  const [todoCounts, monthlyStats, jobPerformance, jobStatusCounts] = await Promise.all([
    getTodoCounts(ctx.tenantId),
    getMonthlyStats(ctx.tenantId),
    getJobPerformance(ctx.tenantId),
    getJobStatusCounts(ctx.tenantId),
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
    >
      {/* ── Greeting header ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 24,
      }}>
        <h1 style={{
          fontFamily: "'Noto Serif JP', serif",
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

      {/* ── Stat cards (4枚) ── */}
      <DashboardStatCards
        todoCounts={todoCounts}
        monthlyStats={monthlyStats}
        planType={ctx.planType}
        activeJobCount={jobStatusCounts.active}
      />

      {/* ── S1b placeholders ──────────────────────────────────────
          以下のセクションは Session S1b で実装する:
          - UpgradeBanner       (無料プラン訴求バナー)
          - EditorInvitation    (Opinio編集部取材案内バナー)
          - PendingMeetings     (未対応カジュアル面談リスト)
          - ActivityList        (最近のアクティビティ)
          - MatchCandidates     (マッチ候補者 free/paid)
          - JobStatusCards      (求人ステータス3カード)
          - TeamMembers         (チームメンバー)
          - RecruiterProfile    (採用担当者公開設定widget)
      ─────────────────────────────────────────────────────────── */}

      {/* ── Job performance (S1b で JobStatusCards + 求人管理リンクに統合予定) ── */}
      <section style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "22px 26px",
        marginTop: 4,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
        }}>
          <div style={{
            fontFamily: "'Noto Serif JP', serif",
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
