import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext, getMonthlyStats, getJobPerformance, getTodoCounts } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import {
  BarChart2, Users, Briefcase, MessageSquare, TrendingUp, TrendingDown,
  Eye, ClipboardList, AlertCircle, CheckCircle2, Minus,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "分析 | OPINIO Business" }, robots: { index: false, follow: false } };

// ─── 6ヶ月 monthly stats 取得 ───────────────────────────────────────────────

async function fetchSixMonthStats(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 10));
  }
  const { data } = await supabase
    .from("ow_business_monthly_stats")
    .select("month, applications, scouts, interviews, offers")
    .eq("tenant_id", tenantId)
    .in("month", months);

  return months.map((m) => {
    const row = (data ?? []).find((r: Record<string, unknown>) => r.month === m);
    const date = new Date(m);
    return {
      label: `${date.getMonth() + 1}月`,
      applications: (row?.applications as number) ?? 0,
      scouts: (row?.scouts as number) ?? 0,
      interviews: (row?.interviews as number) ?? 0,
      offers: (row?.offers as number) ?? 0,
    };
  });
}

// ─── 面談ファネル ─────────────────────────────────────────────────────────────

async function fetchMeetingFunnel(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase
    .from("ow_casual_meetings")
    .select("id, status, created_at")
    .eq("company_id", tenantId);

  const all = data ?? [];
  return {
    total: all.length,
    pending: all.filter((m) => m.status === "pending").length,
    company_contacted: all.filter((m) => m.status === "company_contacted").length,
    scheduled: all.filter((m) => m.status === "scheduled").length,
    completed: all.filter((m) => m.status === "completed").length,
    declined: all.filter((m) => m.status === "declined").length,
  };
}

// ─── 選考ファネル（applications） ────────────────────────────────────────────

async function fetchSelectionFunnel(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase
    .from("ow_job_applications")
    .select("id, status, job_id, ow_jobs!inner(company_id)")
    .eq("ow_jobs.company_id", tenantId);

  const all = data ?? [];
  return {
    total: all.length,
    applied:    all.filter((a) => a.status === "pending" || a.status === "reviewing").length,
    interview1: all.filter((a) => a.status === "interview").length,
    offered:    all.filter((a) => a.status === "accepted").length,
    hired:      all.filter((a) => a.status === "hired").length,
    rejected:   all.filter((a) => a.status === "rejected").length,
  };
}

// ─── プロフィール完成度 ───────────────────────────────────────────────────────

async function fetchCompanyProfile(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase
    .from("ow_companies")
    .select("mission, tagline, description, why_join, fit_positives, is_published, accepting_casual_meetings")
    .eq("id", tenantId)
    .maybeSingle();
  const fields = [data?.mission, data?.tagline, data?.description, data?.why_join, data?.fit_positives];
  const score = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  return { score, isPublished: !!data?.is_published, acceptingMeetings: !!data?.accepting_casual_meetings };
}

// ─── アクティビティログ ───────────────────────────────────────────────────────

async function fetchRecentActivities(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase
    .from("ow_activities")
    .select("id, type, description, created_at")
    .eq("company_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, delta, color = "var(--royal)", icon,
}: {
  label: string; value: string | number; sub?: string; delta?: number;
  color?: string; icon: React.ReactNode;
}) {
  const showDelta = delta !== undefined && delta !== 0;
  const up = (delta ?? 0) > 0;
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color, marginBottom: 8, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 28, fontWeight: 700, color: "var(--ink)", lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginTop: 4 }}>{label}</div>
      {showDelta && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          fontSize: 11, color: up ? "var(--success)" : "var(--error)", fontWeight: 600,
        }}>
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {up ? "+" : ""}{delta} 先月比
        </div>
      )}
      {!showDelta && sub && <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 14, fontWeight: 700, color: "var(--ink)",
      marginBottom: 14, paddingBottom: 10,
      borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {children}
    </h2>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
    </div>
  );
}

type MonthRow = { label: string; applications: number; scouts: number; interviews: number; offers: number };

function MultiBarChart({ data }: { data: MonthRow[] }) {
  const max = Math.max(...data.flatMap((d) => [d.applications, d.scouts, d.interviews]), 1);
  const series = [
    { key: "applications" as const, label: "応募", color: "var(--royal)" },
    { key: "scouts" as const, label: "スカウト", color: "var(--accent)" },
    { key: "interviews" as const, label: "面談", color: "var(--purple)" },
  ];
  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 14 }} aria-hidden="true">
        {series.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>
      {/* Chart - decorative, screen reader gets data from summary text */}
      <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
        {data.map((d) => (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, width: "100%", height: 100, justifyContent: "center" }}>
              {series.map((s) => {
                const v = d[s.key];
                const h = Math.max((v / max) * 100, v > 0 ? 6 : 1);
                return (
                  <div key={s.key} title={`${s.label}: ${v}`} style={{
                    flex: 1, borderRadius: "3px 3px 0 0",
                    height: `${h}%`, background: v > 0 ? s.color : "var(--line-soft)",
                  }} />
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{d.label}</div>
          </div>
        ))}
      </div>
      {/* Screen-reader summary */}
      <p className="sr-only">
        月次データ: {data.map((d) => `${d.label} — 応募${d.applications}件、面談${d.interviews}件`).join("、")}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    published: { label: "公開中", bg: "var(--success-soft)", color: "var(--success)" },
    active:    { label: "公開中", bg: "var(--success-soft)", color: "var(--success)" }, // 旧ステータス
    pending_review: { label: "審査中", bg: "var(--warm-soft)", color: "var(--warm)" },
    draft: { label: "下書き", bg: "var(--line-soft)", color: "var(--ink-mute)" },
    private: { label: "非公開", bg: "var(--line-soft)", color: "var(--ink-mute)" },
    rejected: { label: "差戻し", bg: "var(--error-soft)", color: "var(--error)" },
  };
  const s = map[status ?? ""] ?? { label: status ?? "—", bg: "var(--line-soft)", color: "var(--ink-mute)" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "今";
  if (h < 24) return `${h}h前`;
  const d = Math.floor(h / 24);
  if (d === 1) return "昨日";
  if (d < 7) return `${d}日前`;
  return `${Math.floor(d / 7)}週間前`;
}

// ─── No-tenant fallback ───────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const tenantId = ctx.tenantId;

  // 並列フェッチ
  const [monthly, sixMonth, jobPerf, todos, meetings, profile, selection] = await Promise.all([
    getMonthlyStats(tenantId),
    fetchSixMonthStats(supabase, tenantId),
    getJobPerformance(tenantId, 15),
    getTodoCounts(tenantId),
    fetchMeetingFunnel(supabase, tenantId),
    fetchCompanyProfile(supabase, tenantId),
    fetchSelectionFunnel(supabase, tenantId),
  ]);
  const activities = await fetchRecentActivities(supabase, tenantId);

  const { current: cur, delta } = monthly;

  // 求人ステータス集計 (jobPerf より)
  // ステータスは published / pending_review / draft / rejected / private の5値
  const jobStats = {
    total: jobPerf.length,
    published: jobPerf.filter((j) => j.status === "published").length,
    pending: jobPerf.filter((j) => j.status === "pending_review").length,
    draft: jobPerf.filter((j) => j.status === "draft").length,
  };

  const conversionRate = meetings.total > 0
    ? Math.round((meetings.completed / meetings.total) * 100)
    : 0;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={tenantId}
    >
      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 4,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <BarChart2 size={20} color="var(--royal)" strokeWidth={2.2} />
          採用分析
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
          当月の採用活動サマリーと求人パフォーマンスを確認できます
        </p>
      </div>

      {/* ── Todoアラート ── */}
      {(todos.reply_overdue > 0 || todos.new_applications > 0 || todos.interviews_today > 0) && (
        <div style={{
          background: "var(--warm-soft)",
          border: "1px solid #FDE68A",
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex", flexWrap: "wrap", gap: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#92400E", fontWeight: 600 }}>
            <AlertCircle size={14} />
            対応が必要な項目
          </div>
          {todos.reply_overdue > 0 && (
            <span style={{ fontSize: 12, color: "#92400E" }}>返信遅延: <strong>{todos.reply_overdue}件</strong></span>
          )}
          {todos.new_applications > 0 && (
            <span style={{ fontSize: 12, color: "#92400E" }}>新規応募: <strong>{todos.new_applications}件</strong></span>
          )}
          {todos.interviews_today > 0 && (
            <span style={{ fontSize: 12, color: "#92400E" }}>本日面談: <strong>{todos.interviews_today}件</strong></span>
          )}
        </div>
      )}

      {/* ── KPI カード（当月） ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle><TrendingUp size={14} color="var(--royal)" /> 当月サマリー</SectionTitle>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 14,
        }}>
          <KpiCard
            label="応募数" value={cur.applications} delta={delta.applications}
            color="var(--royal)" icon={<ClipboardList size={16} />}
          />
          <KpiCard
            label="スカウト" value={cur.scouts} delta={delta.scouts}
            color="var(--accent)" icon={<Users size={16} />}
          />
          <KpiCard
            label="面談実施" value={cur.interviews} delta={delta.interviews}
            color="var(--purple)" icon={<MessageSquare size={16} />}
          />
          <KpiCard
            label="オファー" value={cur.offers} delta={delta.offers}
            color="var(--success)" icon={<CheckCircle2 size={16} />}
          />
        </div>
      </div>

      {/* ── ステータスバー（公開求人・面談転換率） ── */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
          padding: "10px 18px", flex: "1 1 200px",
        }}>
          <Briefcase size={15} color="var(--royal)" strokeWidth={2.2} />
          <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>公開求人</span>
          <span style={{ marginLeft: "auto", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 18, color: "var(--royal)" }}>
            {jobStats.published}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>/ {jobStats.total}件</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
          padding: "10px 18px", flex: "1 1 200px",
        }}>
          <TrendingUp size={15} color="var(--warm)" strokeWidth={2.2} />
          <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>面談転換率</span>
          <span style={{ marginLeft: "auto", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 18, color: "var(--warm)" }}>
            {conversionRate}%
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>完了{meetings.completed} / 申込{meetings.total}</span>
        </div>
      </div>

      {/* ── 採用パイプライン ファネル ── */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", marginBottom: 28 }}>
        <SectionTitle><TrendingUp size={14} color="var(--royal)" /> 採用パイプライン</SectionTitle>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "stretch", minWidth: 600, gap: 0 }}>
            {[
              { label: "面談申込", sub: "カジュアル面談", count: meetings.total, color: "var(--accent)", bg: "#EEF2FF" },
              { label: "面談完了", sub: "カジュアル面談", count: meetings.completed, color: "var(--purple)", bg: "var(--purple-soft)" },
              { label: "応募", sub: "書類選考", count: selection.applied, color: "var(--royal)", bg: "var(--royal-50)" },
              { label: "面接", sub: "選考・面接中", count: selection.interview1, color: "#0EA5E9", bg: "#E0F2FE" },
              { label: "内定・オファー", sub: "採用確定", count: selection.offered + selection.hired, color: "var(--success)", bg: "var(--success-soft)" },
            ].map((step, i, arr) => (
              <div key={step.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                <div style={{
                  flex: 1, background: step.bg, borderRadius: 10,
                  padding: "16px 14px", textAlign: "center",
                }}>
                  <div style={{
                    fontFamily: "Inter, sans-serif", fontSize: 28, fontWeight: 800,
                    color: step.color, lineHeight: 1, marginBottom: 4,
                  }}>
                    {step.count}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{step.label}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ padding: "0 6px", color: "var(--ink-mute)", fontSize: 18, flexShrink: 0 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* 離脱ステータス */}
        <div style={{ display: "flex", gap: 20, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
            面談辞退: <strong style={{ color: "var(--error)" }}>{meetings.declined}</strong>件
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
            選考不合格: <strong style={{ color: "var(--error)" }}>{selection.rejected}</strong>件
          </span>
        </div>
      </div>

      {/* ── 求人ステータス ── */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", marginBottom: 28 }}>
        <SectionTitle><Briefcase size={14} color="var(--royal)" /> 求人ステータス</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "公開中", count: jobStats.published, total: jobStats.total, color: "var(--success)" },
            { label: "審査中", count: jobStats.pending, total: jobStats.total, color: "var(--warm)" },
            { label: "下書き", count: jobStats.draft, total: jobStats.total, color: "var(--ink-mute)" },
          ].map((row) => (
            <div key={row.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{row.label}</span>
                <span style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 700, color: "var(--ink)" }}>
                  {row.count}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-mute)" }}> / {row.total}</span>
                </span>
              </div>
              <ProgressBar value={row.count} max={Math.max(row.total, 1)} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {/* ── 6ヶ月バーチャート ── */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", marginBottom: 28 }}>
        <SectionTitle><BarChart2 size={14} color="var(--royal)" /> 月次推移（直近6ヶ月）</SectionTitle>
        <MultiBarChart data={sixMonth} />
      </div>

      {/* ── 求人パフォーマンス ── */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", marginBottom: 28 }}>
        <SectionTitle><Eye size={14} color="var(--royal)" /> 求人パフォーマンス</SectionTitle>
        {jobPerf.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-mute)", fontSize: 13 }}>
            求人データがまだありません
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }} aria-label="求人パフォーマンス一覧">
              <caption style={{ display: "none" }}>求人タイトル・ステータス・閲覧数・応募数・転換率の一覧</caption>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["求人タイトル", "ステータス", "閲覧数", "応募数", "転換率"].map((h) => (
                    <th key={h} scope="col" style={{
                      padding: "8px 12px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobPerf.map((j) => (
                  <tr key={j.job_id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--ink)", maxWidth: 240 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {j.title}
                      </div>
                      {j.isUnderperforming && (
                        <div style={{ fontSize: 10, color: "var(--error)", marginTop: 2 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>転換率が業界平均を下回っています
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge status={j.status} /></td>
                    <td style={{ padding: "10px 12px", fontFamily: "Inter, sans-serif", color: "var(--ink-soft)", textAlign: "right" }}>
                      {j.view_count.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "Inter, sans-serif", color: "var(--ink-soft)", textAlign: "right" }}>
                      {j.application_count}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{
                        fontFamily: "Inter, sans-serif", fontWeight: 700,
                        color: j.isUnderperforming ? "var(--error)" : j.conversion_rate_pct >= 5 ? "var(--success)" : "var(--ink)",
                      }}>
                        {j.conversion_rate_pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── プロフィール完成度 + アクティビティ ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* プロフィール完成度 */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px" }}>
          <SectionTitle>企業プロフィール充実度</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: `conic-gradient(var(--royal) ${profile.score * 3.6}deg, var(--line) 0)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: "50%", background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: "var(--royal)",
              }}>
                {profile.score}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                {profile.score >= 80 ? "充実しています" : profile.score >= 50 ? "もう少し埋めましょう" : "基本情報を入力しましょう"}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                企業情報が充実するほど応募率が向上します
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "公開ステータス", ok: profile.isPublished, hint: profile.isPublished ? "公開中" : "非公開" },
              { label: "カジュアル面談受付", ok: profile.acceptingMeetings, hint: profile.acceptingMeetings ? "受付中" : "停止中" },
              { label: "ミッション記入", ok: profile.score >= 20, hint: "" },
              { label: "会社説明記入", ok: profile.score >= 40, hint: "" },
              { label: "Why Join 記入", ok: profile.score >= 60, hint: "" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  background: item.ok ? "var(--success-soft)" : "var(--line-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {item.ok
                    ? <CheckCircle2 size={10} color="var(--success)" />
                    : <Minus size={10} color="var(--ink-mute)" />
                  }
                </div>
                <span style={{ fontSize: 12, color: item.ok ? "var(--ink)" : "var(--ink-mute)" }}>{item.label}</span>
                {item.hint && <span style={{ fontSize: 11, color: item.ok ? "var(--success)" : "var(--error)", marginLeft: "auto" }}>{item.hint}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* アクティビティログ */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px" }}>
          <SectionTitle>最近のアクティビティ</SectionTitle>
          {activities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-mute)", fontSize: 13 }}>
              アクティビティはまだありません
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(activities as Record<string, unknown>[]).map((a, i) => (
                <div key={a.id as string} style={{
                  padding: "10px 0",
                  borderBottom: i < activities.length - 1 ? "1px solid var(--line-soft)" : "none",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "var(--royal)", marginTop: 6, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5, wordBreak: "break-all" }}>
                      {a.description as string}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 2 }}>
                      {formatRelative(a.created_at as string)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BusinessLayout>
  );
}
