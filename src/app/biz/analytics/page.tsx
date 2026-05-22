import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "分析 | OPINIO Business" };

// ─── データ取得 ────────────────────────────────────────────────────────────────

async function fetchAnalyticsData(supabase: ReturnType<typeof createClient>, companyId: string) {
  const [
    { data: jobs },
    { data: meetings },
    { data: activities },
    { data: company },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("ow_jobs")
      .select("id, status, published_at, updated_at")
      .eq("company_id", companyId),
    supabase
      .from("ow_casual_meetings")
      .select("id, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ow_activities")
      .select("id, type, description, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("ow_companies")
      .select("name, is_published, accepting_casual_meetings, fit_positives, fit_negatives, why_join, mission, tagline, description")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("ow_company_admins")
      .select("id")
      .eq("company_id", companyId),
  ]);

  // ── 求人集計 ──
  const allJobs = jobs ?? [];
  const jobCounts = {
    total: allJobs.length,
    published: allJobs.filter((j) => j.status === "published").length,
    pending_review: allJobs.filter((j) => j.status === "pending_review").length,
    draft: allJobs.filter((j) => j.status === "draft").length,
    private: allJobs.filter((j) => j.status === "private").length,
    rejected: allJobs.filter((j) => j.status === "rejected").length,
  };

  // ── 面談集計 ──
  const allMeetings = meetings ?? [];
  const meetingCounts = {
    total: allMeetings.length,
    pending: allMeetings.filter((m) => m.status === "pending").length,
    company_contacted: allMeetings.filter((m) => m.status === "company_contacted").length,
    scheduled: allMeetings.filter((m) => m.status === "scheduled").length,
    completed: allMeetings.filter((m) => m.status === "completed").length,
    declined: allMeetings.filter((m) => m.status === "declined").length,
  };

  // ── 月次面談数（直近6ヶ月）──
  const now = new Date();
  const monthlyMeetings = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = `${d.getMonth() + 1}月`;
    const count = allMeetings.filter((m) => {
      const c = new Date(m.created_at as string);
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
    }).length;
    return { label, count };
  });

  // ── プロフィール完成度 ──
  const c = company;
  const profileFields = [
    !!c?.mission,
    !!c?.tagline,
    !!c?.description,
    !!c?.why_join,
    !!c?.fit_positives,
    !!c?.fit_negatives,
  ];
  const profileScore = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

  // ── 面談転換率 ──
  const conversionRate = meetingCounts.total > 0
    ? Math.round((meetingCounts.completed / meetingCounts.total) * 100)
    : 0;

  return {
    jobCounts,
    meetingCounts,
    monthlyMeetings,
    profileScore,
    conversionRate,
    activities: activities ?? [],
    memberCount: (members ?? []).length,
    isPublished: !!c?.is_published,
    acceptingMeetings: !!c?.accepting_casual_meetings,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = "var(--royal)", icon,
}: {
  label: string; value: string | number; sub?: string;
  color?: string; icon: React.ReactNode;
}) {
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
      {sub && <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: "var(--font-noto-serif)",
      fontSize: 15, fontWeight: 600, color: "var(--ink)",
      marginBottom: 14, paddingBottom: 10,
      borderBottom: "1px solid var(--line)",
    }}>
      {children}
    </h2>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: color, borderRadius: 4,
        transition: "width 0.4s ease",
      }} />
    </div>
  );
}

type MonthData = { label: string; count: number };

function BarChart({ data }: { data: MonthData[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 10, fontFamily: "Inter, sans-serif", color: "var(--ink-mute)", fontWeight: 700 }}>
              {d.count > 0 ? d.count : ""}
            </div>
            <div style={{
              width: "100%", borderRadius: "4px 4px 0 0",
              height: `${Math.max(pct, d.count > 0 ? 8 : 2)}%`,
              background: d.count > 0 ? "var(--royal)" : "var(--line)",
              transition: "height 0.4s ease",
            }} />
            <div style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
        企業アカウントが必要です
      </div>
    </BusinessLayout>
  );
}

export default async function BizAnalyticsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  const supabase = createClient();
  const data = await fetchAnalyticsData(supabase, ctx.tenantId);

  const {
    jobCounts, meetingCounts, monthlyMeetings,
    profileScore, conversionRate, activities,
    memberCount, isPublished, acceptingMeetings,
  } = data;

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {
    job_published: "求人公開",
    job_updated: "求人更新",
    company_info_updated: "企業情報更新",
    meeting_scheduled: "面談確定",
    meeting_completed: "面談完了",
    casual_meeting_applied: "面談申込",
    offer_sent: "オファー送信",
  };

  const ACTIVITY_COLORS: Record<string, string> = {
    job_published: "var(--success)",
    job_updated: "var(--success)",
    company_info_updated: "var(--accent)",
    meeting_scheduled: "var(--purple)",
    meeting_completed: "var(--purple)",
    casual_meeting_applied: "var(--warm)",
    offer_sent: "var(--royal)",
  };

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      {/* ページヘッダー */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 26, fontWeight: 500, color: "var(--ink)",
          letterSpacing: "0.02em", marginBottom: 6,
        }}>
          分析
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          求人・面談・プロフィールのパフォーマンスをまとめて確認できます。
        </p>
      </div>

      {/* ── KPI カード ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 14, marginBottom: 28,
      }}>
        <KpiCard
          label="掲載求人"
          value={jobCounts.published}
          sub={`全${jobCounts.total}件`}
          color="var(--success)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>}
        />
        <KpiCard
          label="面談申込"
          value={meetingCounts.total}
          sub={`完了 ${meetingCounts.completed}件`}
          color="var(--warm)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
        <KpiCard
          label="面談転換率"
          value={`${conversionRate}%`}
          sub="申込→完了"
          color="var(--purple)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        />
        <KpiCard
          label="チームメンバー"
          value={memberCount}
          color="var(--royal)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <KpiCard
          label="プロフィール完成度"
          value={`${profileScore}%`}
          sub={profileScore >= 80 ? "良好" : "改善余地あり"}
          color={profileScore >= 80 ? "var(--success)" : "var(--warm)"}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
        />
        <KpiCard
          label="ステータス"
          value={isPublished ? "公開中" : "非公開"}
          sub={acceptingMeetings ? "面談受付中" : "面談停止中"}
          color={isPublished ? "var(--success)" : "var(--ink-mute)"}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
      </div>

      {/* ── 2カラム ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* 求人ステータス内訳 */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px" }}>
          <SectionTitle>求人ステータス</SectionTitle>
          {jobCounts.total === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "var(--ink-mute)", fontSize: 13 }}>
              求人が登録されていません
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "公開中", count: jobCounts.published, color: "var(--success)" },
                { label: "審査申請中", count: jobCounts.pending_review, color: "var(--warm)" },
                { label: "下書き", count: jobCounts.draft, color: "var(--ink-mute)" },
                { label: "非公開", count: jobCounts.private, color: "var(--accent)" },
                { label: "却下", count: jobCounts.rejected, color: "var(--error)" },
              ].filter((s) => s.count > 0).map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 700, color: s.color }}>
                      {s.count}件
                    </span>
                  </div>
                  <ProgressBar value={s.count} max={jobCounts.total} color={s.color} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 面談ファネル */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px" }}>
          <SectionTitle>面談ファネル</SectionTitle>
          {meetingCounts.total === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "var(--ink-mute)", fontSize: 13 }}>
              面談申込はまだありません
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "申込受付", count: meetingCounts.pending, color: "var(--warm)" },
                { label: "企業コンタクト済", count: meetingCounts.company_contacted, color: "var(--accent)" },
                { label: "日程確定", count: meetingCounts.scheduled, color: "var(--purple)" },
                { label: "面談完了", count: meetingCounts.completed, color: "var(--success)" },
                { label: "辞退", count: meetingCounts.declined, color: "var(--error)" },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 700, color: s.color }}>
                      {s.count}件
                    </span>
                  </div>
                  <ProgressBar value={s.count} max={meetingCounts.total} color={s.color} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 月次面談数グラフ ── */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", marginBottom: 20 }}>
        <SectionTitle>月次カジュアル面談数（直近6ヶ月）</SectionTitle>
        <BarChart data={monthlyMeetings} />
        {meetingCounts.total === 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-mute)", marginTop: 12 }}>
            面談申込が増えると推移グラフが表示されます
          </p>
        )}
      </div>

      {/* ── アクティビティログ ── */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px" }}>
        <SectionTitle>アクティビティログ</SectionTitle>
        {activities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: "var(--ink-mute)", fontSize: 13 }}>
            まだアクティビティがありません
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {activities.slice(0, 20).map((a, i) => {
              const typeLabel = ACTIVITY_TYPE_LABELS[a.type as string] ?? (a.type as string);
              const dotColor = ACTIVITY_COLORS[a.type as string] ?? "var(--ink-mute)";
              const dt = new Date(a.created_at as string);
              const dateStr = dt.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
              return (
                <div key={a.id as string} style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  alignItems: "start",
                  gap: 12,
                  paddingBottom: i < activities.length - 1 ? 12 : 0,
                  marginBottom: i < activities.length - 1 ? 12 : 0,
                  borderBottom: i < activities.length - 1 ? "1px solid var(--line-soft)" : "none",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: `${dotColor}20`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
                  </div>
                  <div>
                    <span style={{
                      display: "inline-block", fontSize: 10, fontWeight: 700,
                      color: dotColor, background: `${dotColor}18`,
                      padding: "2px 8px", borderRadius: 100,
                      marginBottom: 3, fontFamily: "Inter, sans-serif",
                    }}>
                      {typeLabel}
                    </span>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                      {a.description as string}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", marginTop: 2 }}>
                    {dateStr}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BusinessLayout>
  );
}
