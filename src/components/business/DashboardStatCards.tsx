import type { TodoCounts, MonthlyStatsWithDelta } from "@/lib/business/dashboard";

type Props = {
  todoCounts: TodoCounts;
  monthlyStats: MonthlyStatsWithDelta;
  planType?: string | null;
  activeJobCount?: number;
};

type StatCardProps = {
  icon: React.ReactNode;
  iconVariant: "urgent" | "amber" | "purple" | "success";
  value: React.ReactNode;
  label: string;
  trend: React.ReactNode;
  urgent?: boolean;
};

function StatCard({ icon, iconVariant, value, label, trend, urgent }: StatCardProps) {
  const iconBg: Record<string, string> = {
    urgent: "var(--warm)",
    amber: "var(--warm-soft)",
    purple: "var(--purple-soft)",
    success: "var(--success-soft)",
  };
  const iconColor: Record<string, string> = {
    urgent: "#fff",
    amber: "#B45309",
    purple: "var(--purple)",
    success: "var(--success)",
  };

  return (
    <div
      style={{
        background: urgent ? "linear-gradient(to bottom, var(--warm-soft), #fff)" : "#fff",
        border: urgent ? "1px solid #FDE68A" : "1px solid var(--line)",
        borderRadius: 12,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        if (!urgent) el.style.borderColor = "var(--royal-100)";
        el.style.boxShadow = "0 4px 14px rgba(15,23,42,0.06)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = urgent ? "#FDE68A" : "var(--line)";
        el.style.boxShadow = "none";
        el.style.transform = "none";
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: iconBg[iconVariant],
        color: iconColor[iconVariant],
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 10,
      }}>
        {icon}
      </div>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 26, fontWeight: 700, color: "var(--ink)",
        lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 500, lineHeight: 1.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 3 }}>
        {trend}
      </div>
    </div>
  );
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export function DashboardStatCards({ todoCounts, monthlyStats, planType, activeJobCount = 0 }: Props) {
  const isPaid = !!planType;
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
      {/* Card 1: 未対応カジュアル面談（urgent） */}
      <StatCard
        urgent={pendingCount > 0}
        iconVariant="urgent"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        }
        value={pendingCount}
        label="未対応のカジュアル面談"
        trend={
          pendingCount > 0
            ? <span style={{ color: "#B45309" }}>⚠ 要対応</span>
            : <span style={{ color: "var(--success)" }}>✓ 対応済み</span>
        }
      />

      {/* Card 2: 公開中の求人（plan-gated） */}
      <StatCard
        iconVariant="amber"
        icon={isPaid
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/></svg>
          : <LockIcon />
        }
        value={isPaid ? activeJobCount : "—"}
        label="公開中の求人"
        trend={
          isPaid
            ? <span style={{ color: "var(--success)" }}>↑ 先月比 +1</span>
            : <span style={{ color: "var(--ink-mute)" }}>有料プランで解放</span>
        }
      />

      {/* Card 3: マッチ候補者（plan-gated） */}
      <StatCard
        iconVariant="purple"
        icon={isPaid
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
          : <LockIcon />
        }
        value={isPaid ? monthlyStats.current.scouts : "—"}
        label="マッチ候補者（今月）"
        trend={
          isPaid
            ? <span style={{ color: "var(--success)" }}>↑ 先月比 +{monthlyStats.delta.scouts}件</span>
            : <span style={{ color: "var(--ink-mute)" }}>有料プランで解放</span>
        }
      />

      {/* Card 4: 面談完了（常時表示） */}
      <StatCard
        iconVariant="success"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
          </svg>
        }
        value={completedInterviews}
        label="面談完了（今月）"
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
