import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyCard } from "@/components/business/CompanyCard";
import { JobPerformanceList } from "@/components/business/JobPerformanceList";
import { UpgradeBanner } from "@/components/business/UpgradeBanner";
import { EditorInvitation } from "@/components/business/EditorInvitation";
import { JobStatusCards } from "@/components/business/JobStatusCards";
import { TeamMembers } from "@/components/business/TeamMembers";
import { DashboardMockView } from "./DashboardMockView";
import {
  getTenantContext,
  getJobPerformance,
  getJobStatusCounts,
} from "@/lib/business/dashboard";
import { fetchTeamMembersForDashboard } from "@/lib/business/team";
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
  const [jobPerformance, jobStatusCounts, teamMembers] = await Promise.all([
    getJobPerformance(ctx.tenantId),
    getJobStatusCounts(ctx.tenantId),
    fetchTeamMembersForDashboard(supabase, ctx.tenantId),
  ]);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      {/* ── Company card ── */}
      <CompanyCard
        tenantId={ctx.tenantId}
        tenantName={ctx.tenantName}
        logoGradient={ctx.logoGradient}
        logoLetter={ctx.logoLetter}
      />

      {/* ── Upgrade banner ── */}
      <UpgradeBanner />

      {/* ── Editor invitation ── */}
      <EditorInvitation />

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
