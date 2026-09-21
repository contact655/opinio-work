import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchJobsForCompany } from "@/lib/business/jobs";
import { createClient } from "@/lib/supabase/server";
import { Briefcase, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "分析 | OPINIO Business" }, robots: { index: false, follow: false } };

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

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    published: { label: "公開中", bg: "var(--success-soft)", color: "var(--success-ink)" },
    pending_review: { label: "審査中", bg: "var(--warm-soft)", color: "var(--warm-ink)" },
    draft: { label: "下書き", bg: "var(--line-soft)", color: "var(--ink-mute)" },
    private: { label: "非公開", bg: "var(--line-soft)", color: "var(--ink-mute)" },
    rejected: { label: "差戻し", bg: "var(--error-soft)", color: "var(--error-ink)" },
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
  /* ★2026-09-21 に、**永久に0になる数字**を外した。
        `ow_business_monthly_stats` / `ow_business_job_performance` / `ow_business_todo_counts`
        の3つのビューは**`ow_applications`（アプリが一度も書かない表）**と
        **`ow_job_views`（同じく書き込み0件）**を数えており、アプリが応募を記録する
        `ow_job_applications` を見ていなかった。「スカウト」はビューに 0 と直書き。
     ⚠️ 3つのビューは 2026-09-22 に DROP した（`20260922010000_drop_unused_business_views.sql`）。
        月次の推移を戻すなら
        `ow_job_applications` と `ow_casual_meetings` から数え直す（ビューは別作業で扱う）。
     ⚠️ 求人ごとの数字は、求人管理と**同じ関数**（`fetchJobsForCompany`）から取る。 */
  const [jobs, meetings, selection] = await Promise.all([
    fetchJobsForCompany(supabase, tenantId),
    fetchMeetingFunnel(supabase, tenantId),
    fetchSelectionFunnel(supabase, tenantId),
  ]);
  const activities = await fetchRecentActivities(supabase, tenantId);

  // 求人ステータス集計 (jobPerf より)
  // ステータスは published / pending_review / draft / rejected / private の5値
  const jobStats = {
    total: jobs.length,
    published: jobs.filter((j) => j.status === "published").length,
    pending: jobs.filter((j) => j.status === "pending_review").length,
    draft: jobs.filter((j) => j.status === "draft").length,
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>分析</h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
          面談の申込み・応募の件数と、求人ごとの反応を確認できます。
        </p>
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
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, fontSize: 18, color: "var(--royal)" }}>
            {jobStats.published}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>/ {jobStats.total}件</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
          padding: "10px 18px", flex: "1 1 200px",
        }}>
          <TrendingUp size={15} color="var(--warm-ink)" strokeWidth={2.2} />
          <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>面談転換率</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, fontSize: 18, color: "var(--warm-ink)" }}>
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
              /* ⚠️ #0EA5E9 は #E0F2FE の上で 2.42。数字は 28px なので基準は 3.0 だが届かない
                    （他の4段階は基準を満たしていた。ここだけ生の hex だった）。
                    sky-700 #0369A1 にして 5.17。塗り（bg）は変えていない。 */
              { label: "面接", sub: "選考・面接中", count: selection.interview1, color: "#0369A1", bg: "#E0F2FE" },
              { label: "内定・オファー", sub: "採用確定", count: selection.offered + selection.hired, color: "var(--success-ink)", bg: "var(--success-soft)" },
            ].map((step, i, arr) => (
              <div key={step.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                <div style={{
                  flex: 1, background: step.bg, borderRadius: 10,
                  padding: "16px 14px", textAlign: "center",
                }}>
                  <div style={{
                    fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 28, fontWeight: 800,
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
            { label: "公開中", count: jobStats.published, total: jobStats.total, color: "var(--success-ink)" },
            { label: "審査中", count: jobStats.pending, total: jobStats.total, color: "var(--warm-ink)" },
            { label: "下書き", count: jobStats.draft, total: jobStats.total, color: "var(--ink-mute)" },
          ].map((row) => (
            <div key={row.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{row.label}</span>
                <span style={{ fontSize: 12, fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, color: "var(--ink)" }}>
                  {row.count}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-mute)" }}> / {row.total}</span>
                </span>
              </div>
              <ProgressBar value={row.count} max={Math.max(row.total, 1)} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {/* ── 求人ごとの反応 ──
             ★2026-09-21 に閲覧数・転換率・「業界平均を下回っています」を外した。
                閲覧数は記録されておらず（`ow_job_views` に書き込むコードが無い）、
                業界平均（`INDUSTRY_AVG_CONVERSION_RATE`）は根拠の無い固定値だった。
                出すのは実際に数えている面談申込と応募だけ（求人管理のカードと同じ数字）。 */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", marginBottom: 28 }}>
        <SectionTitle><Briefcase size={14} color="var(--royal)" /> 求人ごとの反応</SectionTitle>
        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-mute)", fontSize: 13 }}>
            求人がまだありません
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }} aria-label="求人ごとの面談申込数と応募数">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["求人タイトル", "状態", "面談申込", "応募"].map((h, i) => (
                    <th key={h} scope="col" style={{
                      padding: "8px 12px", textAlign: i >= 2 ? "right" : "left",
                      fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--ink)", maxWidth: 320 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.title}>{j.title}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge status={j.status} /></td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-inter), var(--font-noto)", color: "var(--ink-soft)", textAlign: "right" }}>{j.meetingCount}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-inter), var(--font-noto)", color: "var(--ink-soft)", textAlign: "right" }}>{j.applicationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 最近のアクティビティ ──
             ★2026-09-21 に「企業プロフィール充実度」を外した。見ていた mission / why_join /
                fit_positives は企業ページの編集画面に入力欄が無く（2026-07-28 に外した）、
                企業が上げる手段が無かった。何が足りないかはダッシュボードに出している。 */}
      <div>
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
