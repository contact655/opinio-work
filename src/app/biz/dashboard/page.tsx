import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { TodoList } from "@/components/business/TodoList";
import { StatsGrid } from "@/components/business/StatsGrid";
import { JobPerformanceList } from "@/components/business/JobPerformanceList";
import {
  getTenantContext,
  getTodoCounts,
  getMonthlyStats,
  getJobPerformance,
} from "@/lib/business/dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ダッシュボード | Opinio Business",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "おはようございます";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

export default async function BusinessDashboardPage() {
  const ctx = await getTenantContext();

  // ロール未保有: 企業アカウント追加導線
  if (!ctx) {
    return <NoTenantPage />;
  }

  const [todo, stats, jobs] = await Promise.all([
    getTodoCounts(ctx.tenantId),
    getMonthlyStats(ctx.tenantId),
    getJobPerformance(ctx.tenantId),
  ]);

  return (
    <BusinessLayout userName={ctx.userName} tenantName={ctx.tenantName}>
      {/* Greeting */}
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 6, letterSpacing: "-0.01em" }}>
          {greeting()}、{ctx.userName}様
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#6b7280" }}>
          <span>{ctx.tenantName}</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#cbd5e1" }} />
          <span style={{ padding: "2px 10px", borderRadius: 999, background: "#fafaf7", border: "0.5px solid #e8e4dc", fontSize: 11, fontWeight: 600, color: "#0f172a" }}>
            {ctx.planLabel}
          </span>
        </div>
      </header>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <TodoList counts={todo} />
        <StatsGrid stats={stats} />
        <JobPerformanceList jobs={jobs} />
      </div>
    </BusinessLayout>
  );
}

// ─── 企業ロール未保有時 ─────────────────────────────────

import { createClient } from "@/lib/supabase/server";

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        border: "0.5px solid #e5e7eb",
        padding: 40,
        textAlign: "center",
        maxWidth: 560, margin: "60px auto",
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🏢</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
          企業アカウントを追加しますか?
        </h2>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 22 }}>
          このアカウントには、企業ロールが紐付いていません。<br />
          自社情報・求人を管理するには、企業アカウントの追加申請が必要です。
        </p>
        <Link
          href="/biz/auth/signup"
          style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            fontSize: 14, fontWeight: 600, background: "#1D9E75", color: "#fff", textDecoration: "none",
          }}
        >
          企業アカウントを追加 →
        </Link>
        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ fontSize: 12, color: "#6b7280", textDecoration: "underline" }}>
            候補者サイトに戻る
          </Link>
        </div>
      </div>
    </BusinessLayout>
  );
}
