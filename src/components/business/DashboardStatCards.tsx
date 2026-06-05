"use client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { TodoCounts, MonthlyStatsWithDelta } from "@/lib/business/dashboard";

type Props = {
  todoCounts: TodoCounts;
  monthlyStats: MonthlyStatsWithDelta;
  activeJobCount?: number;
};

type StatCardProps = {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  trend: React.ReactNode;
  accentBar?: string;
  href?: string;
  urgent?: boolean;
};

function StatCard({ icon, iconBg, iconColor, value, label, sublabel, trend, accentBar, href, urgent }: StatCardProps) {
  const inner = (
    <div
      style={{
        background: urgent
          ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)"
          : "#fff",
        border: urgent ? "1.5px solid #FCD34D" : "1px solid var(--line)",
        borderRadius: 14,
        padding: "20px 22px 16px",
        cursor: href ? "pointer" : "default",
        transition: "all 0.18s ease",
        position: "relative",
        overflow: "hidden",
        height: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 6px 20px rgba(15,23,42,0.08)";
        el.style.transform = "translateY(-2px)";
        if (!urgent) el.style.borderColor = "var(--royal-100)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "none";
        el.style.transform = "none";
        el.style.borderColor = urgent ? "#FCD34D" : "var(--line)";
      }}
    >
      {/* Top accent bar */}
      {accentBar && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 3, background: accentBar, borderRadius: "14px 14px 0 0",
        }} />
      )}

      {/* Icon + value row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 32, fontWeight: 800, color: "var(--ink)",
            lineHeight: 1, letterSpacing: "-0.02em",
          }}>
            {value}
          </div>
        </div>
      </div>

      {/* Label */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
        {label}
      </div>
      {sublabel && (
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 9, fontWeight: 700,
          color: "var(--ink-mute)", letterSpacing: "0.14em", textTransform: "uppercase",
          marginBottom: 8,
        }}>
          {sublabel}
        </div>
      )}

      {/* Trend */}
      <div style={{
        fontSize: 11, fontWeight: 600,
        display: "flex", alignItems: "center", gap: 4,
        borderTop: "1px solid var(--line-soft)", paddingTop: 8, marginTop: 8,
      }}>
        {trend}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "block" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

export function DashboardStatCards({ todoCounts, monthlyStats, activeJobCount = 0 }: Props) {
  const pendingCount = todoCounts.new_applications;
  const completedInterviews = monthlyStats.current.interviews;
  const interviewDelta = monthlyStats.delta.interviews;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 20,
    }}>
      {/* Card 1: 未対応カジュアル面談 */}
      <StatCard
        urgent={pendingCount > 0}
        iconBg={pendingCount > 0 ? "var(--warm)" : "var(--success-soft)"}
        iconColor={pendingCount > 0 ? "#fff" : "var(--success)"}
        icon={
          pendingCount > 0 ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
            </svg>
          )
        }
        value={pendingCount}
        label="未対応の面談申込"
        sublabel="Pending Meetings"
        accentBar={pendingCount > 0 ? "var(--warm)" : "var(--success)"}
        href="/biz/meetings"
        trend={
          pendingCount > 0
            ? <span style={{ color: "#B45309", display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={13} style={{ flexShrink: 0 }} /> 要対応 — 面談管理へ →</span>
            : <span style={{ color: "var(--success)" }}>✓ すべて対応済み</span>
        }
      />

      {/* Card 2: 公開中の求人 */}
      <StatCard
        iconBg="var(--warm-soft)"
        iconColor="#B45309"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
          </svg>
        }
        value={activeJobCount}
        label="公開中の求人"
        sublabel="Active Jobs"
        accentBar="var(--warm)"
        href={activeJobCount === 0 ? "/biz/jobs/new" : "/biz/jobs"}
        trend={
          activeJobCount === 0
            ? <span style={{ color: "var(--warm)" }}>求人を作成して候補者を集める →</span>
            : <span style={{ color: "var(--success)" }}>↑ 掲載中</span>
        }
      />

      {/* Card 3: マッチ候補者 */}
      <StatCard
        iconBg="var(--purple-soft)"
        iconColor="var(--purple)"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <circle cx="17" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          </svg>
        }
        value={monthlyStats.current.scouts}
        label="マッチ候補者（今月）"
        sublabel="Matched Candidates"
        accentBar="var(--purple)"
        href="/biz/candidates"
        trend={
          monthlyStats.delta.scouts !== 0
            ? <span style={{ color: "var(--success)" }}>↑ 先月比 +{monthlyStats.delta.scouts}件</span>
            : <span style={{ color: "var(--ink-mute)" }}>候補者を探す →</span>
        }
      />

      {/* Card 4: 面談完了 */}
      <StatCard
        iconBg="var(--success-soft)"
        iconColor="var(--success)"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <polyline points="17 11 19 13 23 9"/>
          </svg>
        }
        value={completedInterviews}
        label="面談完了（今月）"
        sublabel="Completed Interviews"
        accentBar="var(--success)"
        trend={
          interviewDelta !== 0
            ? <span style={{ color: interviewDelta > 0 ? "var(--success)" : "var(--error)" }}>
                {interviewDelta > 0 ? "↑" : "↓"} 先月比 {interviewDelta > 0 ? "+" : ""}{interviewDelta}件
              </span>
            : <span style={{ color: "var(--ink-mute)" }}>先月と同数</span>
        }
      />
    </div>
  );
}
