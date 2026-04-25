import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyCard } from "@/components/business/CompanyCard";
import { DashboardStatCards } from "@/components/business/DashboardStatCards";
import { JobPerformanceList } from "@/components/business/JobPerformanceList";
import {
  mockTenantContext,
  mockTodoCounts,
  mockMonthlyStats,
  mockJobStatusCounts,
  mockJobPerformance,
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
        todoCounts={mockTodoCounts}
        monthlyStats={mockMonthlyStats}
        planType={ctx.planType}
        activeJobCount={mockJobStatusCounts.active}
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

      {/* ── Job performance ── */}
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
        <JobPerformanceList jobs={mockJobPerformance} />
      </section>
    </BusinessLayout>
  );
}
