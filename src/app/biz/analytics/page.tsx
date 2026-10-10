import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchJobsForCompany } from "@/lib/business/jobs";
import { countByJob, fetchCompanyReactions, type Fetched, type ReactionRow } from "@/lib/business/reactionCounts";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApproachAnalytics } from "@/lib/approaches/analytics";
import { ApproachTab } from "./ApproachTab";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "分析 | OPINIO Business" }, robots: { index: false, follow: false } };

/**
 * ★分析（2026-09-22 に組み直し）。
 *
 * ── 出しているもの（すべて実際に記録されている表から数える）────────────────
 *   期間の数字   … 面談申込（ow_casual_meetings）／応募（ow_job_applications）／
 *                  企業・求人の保存（ow_bookmarks）
 *   2つのファネル … 面談と応募を**別々に**出す
 *   月ごとの推移 … 直近6か月の面談申込と応募
 *   求人ごと     … 求人管理と同じ `fetchJobsForCompany` の数字＋保存数
 *
 * ⚠️★**面談と応募を1本の矢印でつながないこと。** 2つの記録には結びつきが無い
 *    （面談を終えた人が応募したかは分からない）。2026-09-22 まで
 *    「面談申込 → 面談完了 → 応募 → 面接 → 内定」と1本で描いていた。
 * ⚠️★**取得に失敗したら 0 と出さない。**「取得できませんでした」と出す。
 * ⚠️ 外したもの: 求人ステータスの棒（求人管理と同じ内容）／最近のアクティビティ
 *    （47行中35行が自動保存の「求人を更新」だった）。`ow_activities` の表は残してある。
 * ★閲覧数（2026-10-09 / 段階D）… `ow_page_view_daily`（日ごと・ページごとの件数。閲覧者は持たない）。
 *    記録の仕組みは `POST /api/views` と `lib/views/decide.ts`。記録は 2026-10-09 から。
 *    ⚠️ 古い `ow_page_views` / `ow_job_views` は読まない（書く経路が無く、検証用の閲覧も混ざっている）。
 * ★検証用アカウント（is_test）の面談申込・応募・保存は数えない（2026-10-09）。
 *    面談申込・応募の数え方は `lib/business/reactionCounts.ts` の1か所で、求人管理（/biz/jobs）も同じ関数を通す
 *    ＝ 求人ごとの数字は2つの画面で一致する。⚠️ ここに数え方を書き戻さないこと。
 */

type Period = "30" | "90" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "30", label: "直近30日" },
  { key: "90", label: "直近90日" },
  { key: "all", label: "全期間" },
];

type Row = ReactionRow;

const JST_OFFSET_MS = 9 * 3_600_000;

/** JST の「YYYY-MM」 */
function monthKey(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString().slice(0, 7);
}

function lastMonths(n: number): string[] {
  const now = new Date(Date.now() + JST_OFFSET_MS);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

// ─── 取得 ────────────────────────────────────────────────────────────────────

type ViewRow = { view_date: string; page_type: string; target_id: string; views: number };

/**
 * ★閲覧数（日ごと・ページごと）。⚠️ この表はクライアントのロールに権限が無いので admin で引く。
 *    絞り込みは company_id（＝いま見ている企業）だけ。
 */
async function fetchViews(tenantId: string): Promise<Fetched<ViewRow>> {
  const { data, error } = await createAdminClient()
    .from("ow_page_view_daily")
    .select("view_date, page_type, target_id, views")
    .eq("company_id", tenantId);
  if (error) { console.error("[biz/analytics] views:", error.message); return { ok: false }; }
  return { ok: true, rows: (data ?? []) as ViewRow[] };
}

/** JST の「YYYY-MM-DD」を n 日分（古い順・今日まで） */
function lastDays(n: number): string[] {
  const today = Date.now() + JST_OFFSET_MS;
  return Array.from({ length: n }, (_, i) => new Date(today - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

type SaveRow = { target_type: string; target_id: string; created_at: string };

/**
 * 保存（♡）の件数。⚠️ `ow_bookmarks` は本人の行しか読めない（RLS）ので admin で引く。
 * ⚠️★**誰が保存したかは返さない・画面に出さない。** 取るのは対象と日時だけ。
 * ⚠️ 検証用アカウント（is_test）の保存は数えない。
 */
async function fetchSaves(tenantId: string, jobIds: string[]): Promise<Fetched<SaveRow>> {
  const admin = createAdminClient();
  const targets = [tenantId, ...jobIds];
  const { data, error } = await admin
    .from("ow_bookmarks")
    .select("target_type, target_id, created_at, ow_users!inner(is_test)")
    .in("target_type", ["company", "job"])
    .in("target_id", targets)
    .eq("ow_users.is_test", false);
  if (error) { console.error("[biz/analytics] bookmarks:", error.message); return { ok: false }; }
  return {
    ok: true,
    rows: (data ?? [])
      /* ⚠️ 型の違う id が同じ値になることは無いが、対象の種類まで合わせて数える */
      .filter((r) => (r.target_type === "company" ? r.target_id === tenantId : jobIds.includes(r.target_id)))
      .map((r) => ({ target_type: r.target_type, target_id: r.target_id, created_at: r.created_at })),
  };
}

// ─── 部品 ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 22px",
};
const num: React.CSSProperties = { fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700 };

function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{children}</h2>
      {note && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>{note}</p>}
    </div>
  );
}

function Failed() {
  return <p style={{ margin: 0, fontSize: 13, color: "var(--error-ink)" }}>取得できませんでした。時間をおいて再読み込みしてください。</p>;
}

function Kpi({ label, value, sub }: { label: string; value: number | null; sub?: string }) {
  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>{label}</div>
      <div style={{ ...num, fontSize: 26, color: "var(--ink)", lineHeight: 1 }}>
        {value === null ? <span style={{ fontSize: 14, color: "var(--error-ink)" }}>取得できませんでした</span> : value}
        {value !== null && <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>件</span>}
      </div>
      {sub && <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>{sub}</div>}
    </div>
  );
}

/**
 * ファネル。各段は「そこまで進んだ数」（いまの状態から逆算した累積）。
 * ⚠️ 率は前の段が1件以上のときだけ出す（0で割った 0% を出さない）。
 */
function Funnel({ steps, drop }: { steps: { label: string; count: number }[]; drop: { label: string; count: number } }) {
  const max = Math.max(steps[0]?.count ?? 0, 1);
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].count : null;
          const rate = prev ? Math.round((s.count / prev) * 100) : null;
          return (
            <div key={s.label}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.label}</span>
                {rate !== null && <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>前の段の{rate}%</span>}
                <span style={{ ...num, marginLeft: "auto", fontSize: 15, color: "var(--ink)" }}>{s.count}</span>
              </div>
              <div style={{ height: 8, background: "var(--line-soft)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(s.count / max) * 100}%`, background: "var(--royal)", opacity: 1 - i * 0.15, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-soft)", fontSize: 12, color: "var(--ink-mute)" }}>
        {drop.label}: <strong style={{ ...num, color: "var(--ink-soft)" }}>{drop.count}</strong>件
      </div>
    </div>
  );
}

// ─── ページ ──────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({ searchParams }: { searchParams?: { period?: string; tab?: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const period: Period = searchParams?.period === "90" || searchParams?.period === "all" ? searchParams.period : "30";
  const since = period === "all" ? null : Date.now() - Number(period) * 86_400_000;
  /* ★「声かけ」タブ（2026-10-10 / 段6）。⚠️ 期間と同じく URL に持つ */
  const tab: "overview" | "approaches" = searchParams?.tab === "approaches" ? "approaches" : "overview";
  const approachData = tab === "approaches" ? await getApproachAnalytics(ctx.tenantId, since) : null;
  const qs = (p: Period, t: typeof tab) => {
    const q = new URLSearchParams();
    if (p !== "30") q.set("period", p);
    if (t !== "overview") q.set("tab", t);
    const str = q.toString();
    return str ? `/biz/analytics?${str}` : "/biz/analytics";
  };
  const inPeriod = (iso: string) => since === null || new Date(iso).getTime() >= since;

  const supabase = createClient();
  const tenantId = ctx.tenantId;

  /* ★面談申込・応募は求人管理（/biz/jobs）と同じ関数で数える（検証用アカウントを除く）。2026-10-09 */
  const [reactions, viewsRes] = await Promise.all([fetchCompanyReactions(supabase, tenantId), fetchViews(tenantId)]);
  const jobCounts = countByJob(reactions);
  const jobs = await fetchJobsForCompany(supabase, tenantId, jobCounts);
  const meetingsRes = reactions.meetings;
  const appsRes = reactions.applications;
  const savesRes = await fetchSaves(tenantId, jobs.map((j) => j.id));

  // 期間で絞った行
  const meetings = meetingsRes.ok ? meetingsRes.rows.filter((r) => inPeriod(r.created_at)) : [];
  const apps = appsRes.ok ? appsRes.rows.filter((r) => inPeriod(r.created_at)) : [];
  const saves = savesRes.ok ? savesRes.rows.filter((r) => inPeriod(r.created_at)) : [];

  const count = (rows: Row[], statuses: string[]) => rows.filter((r) => statuses.includes(r.status ?? "")).length;

  /* ★面談。状態は pending / company_contacted / scheduling（旧・scheduled に統合済み）/
        scheduled / completed / declined。⚠️ 辞退はどの段で起きたか分からないので段に含めない */
  const meetingSteps = [
    { label: "申込", count: meetings.length },
    { label: "連絡済み", count: count(meetings, ["company_contacted", "scheduling", "scheduled", "completed"]) },
    { label: "日程確定", count: count(meetings, ["scheduling", "scheduled", "completed"]) },
    { label: "完了", count: count(meetings, ["completed"]) },
  ];
  /* ★応募。状態は pending / reviewing / interview / accepted / hired / rejected */
  const appSteps = [
    { label: "応募", count: apps.length },
    { label: "面接", count: count(apps, ["interview", "accepted", "hired"]) },
    { label: "内定", count: count(apps, ["accepted", "hired"]) },
    { label: "採用", count: count(apps, ["hired"]) },
  ];

  const companySaves = saves.filter((s) => s.target_type === "company").length;
  const jobSaves = saves.filter((s) => s.target_type === "job").length;

  // 月ごと（期間の切り替えに関係なく直近6か月）
  const months = lastMonths(6);
  const monthly = months.map((m) => ({
    month: m,
    meetings: meetingsRes.ok ? meetingsRes.rows.filter((r) => monthKey(r.created_at) === m).length : 0,
    apps: appsRes.ok ? appsRes.rows.filter((r) => monthKey(r.created_at) === m).length : 0,
  }));
  const monthlyMax = Math.max(1, ...monthly.map((m) => Math.max(m.meetings, m.apps)));
  const monthlyEmpty = monthly.every((m) => m.meetings === 0 && m.apps === 0);

  // 求人ごとの保存（全期間。表の他の列と揃える）
  const jobSaveCounts: Record<string, number> = {};
  if (savesRes.ok) for (const s of savesRes.rows) if (s.target_type === "job") jobSaveCounts[s.target_id] = (jobSaveCounts[s.target_id] ?? 0) + 1;

  const periodLabel = PERIODS.find((p) => p.key === period)!.label;

  /* ★求人ごとの面談申込・応募（全期間）。求人管理と同じ `countByJob` の結果（2026-10-09） */
  const jobMeetingCounts = jobCounts.meetings;
  const jobAppCounts = jobCounts.applications;

  /* ★閲覧数。期間は日付で切る（記録が日ごとなので、時刻ではなく JST の日付で比べる） */
  const sinceDate = period === "all" ? null : lastDays(Number(period))[0];
  const viewsInPeriod = viewsRes.ok ? viewsRes.rows.filter((v) => sinceDate === null || v.view_date >= sinceDate) : [];
  const companyViews = viewsInPeriod.filter((v) => v.page_type === "company").reduce((a, v) => a + v.views, 0);
  const jobViews = viewsInPeriod.filter((v) => v.page_type === "job").reduce((a, v) => a + v.views, 0);
  const jobViewCounts: Record<string, number> = {};
  if (viewsRes.ok) for (const v of viewsRes.rows) if (v.page_type === "job") jobViewCounts[v.target_id] = (jobViewCounts[v.target_id] ?? 0) + v.views;

  /* 推移: 直近30日・90日は日ごと、全期間は月ごと（記録の最初の月から） */
  const firstMonth = viewsRes.ok && viewsRes.rows.length > 0
    ? viewsRes.rows.reduce((m, v) => (v.view_date < m ? v.view_date : m), viewsRes.rows[0].view_date).slice(0, 7)
    : null;
  const trendKeys: string[] = period === "all"
    ? (firstMonth ? lastMonths(12).filter((m) => m >= firstMonth) : [])
    : lastDays(Number(period));
  const trend = trendKeys.map((k) => {
    const rows = viewsInPeriod.filter((v) => (period === "all" ? v.view_date.slice(0, 7) === k : v.view_date === k));
    return {
      key: k,
      company: rows.filter((v) => v.page_type === "company").reduce((a, v) => a + v.views, 0),
      job: rows.filter((v) => v.page_type === "job").reduce((a, v) => a + v.views, 0),
    };
  });
  const trendMax = Math.max(1, ...trend.map((t) => t.company + t.job));
  const trendEmpty = trend.every((t) => t.company + t.job === 0);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={tenantId}
    >
      <style>{`
        .an-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .an-funnels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .an-views { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .an-period a:hover { color: var(--ink); }
        @media (max-width: 900px) {
          .an-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .an-funnels { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      {/* ── ヘッダー ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>分析</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
            ページの閲覧、面談の申込み・応募・保存の数と、その後どこまで進んだかを確認できます。
          </p>
        </div>
        {/* 期間。⚠️ URL に持つ（再読み込み・共有で戻る） */}
        <nav className="an-period" aria-label="期間" style={{ display: "flex", gap: 4, background: "var(--line-soft)", borderRadius: 10, padding: 4 }}>
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <Link
                key={p.key}
                href={qs(p.key, tab)}
                aria-current={active ? "page" : undefined}
                data-state={active ? "active" : "inactive"}
                style={{
                  padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: active ? 700 : 500,
                  textDecoration: "none", color: active ? "var(--ink)" : "var(--ink-mute)",
                  background: active ? "#fff" : "transparent",
                  boxShadow: active ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                }}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ★タブ（2026-10-10 / 段6）。⚠️ 選択状態は下線だけ（ui-conventions） */}
      <nav aria-label="分析の種類" style={{ display: "flex", gap: 18, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        {([["overview", "全体"], ["approaches", "声かけ"]] as const).map(([k, label]) => (
          <Link key={k} href={qs(period, k)} aria-current={tab === k ? "page" : undefined} data-state={tab === k ? "active" : "inactive"}
            style={{ padding: "8px 2px", fontSize: 14, fontWeight: tab === k ? 700 : 500, textDecoration: "none",
              color: tab === k ? "var(--ink)" : "var(--ink-mute)", borderBottom: `2px solid ${tab === k ? "var(--royal)" : "transparent"}`, marginBottom: -1 }}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "approaches" ? <ApproachTab data={approachData} periodLabel={periodLabel} /> : (<>
      {/* ── 期間の数字 ── */}
      <div className="an-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="面談の申込み" value={meetingsRes.ok ? meetings.length : null} sub={periodLabel} />
        <Kpi label="応募" value={appsRes.ok ? apps.length : null} sub={periodLabel} />
        <Kpi label="企業ページの保存" value={savesRes.ok ? companySaves : null} sub={`${periodLabel}・求職者が ♡ した数`} />
        <Kpi label="求人の保存" value={savesRes.ok ? jobSaves : null} sub={`${periodLabel}・全求人の合計`} />
      </div>

      {/* ── 閲覧数（2026-10-09 / 段階D） ── */}
      <div style={{ ...card, marginBottom: 16 }} data-state="analytics-views">
        <SectionTitle note={<>
          {periodLabel}。同じ人が同じページを1日に何度開いても1回と数えます。検証用・運営・御社の担当者の閲覧は含みません。
          <br />記録は 2026年10月9日から。誰が見たかは記録していません。
        </>}>閲覧数</SectionTitle>
        {!viewsRes.ok ? <Failed /> : (
          <>
            <div className="an-views" style={{ marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>企業ページ</div>
                <div style={{ ...num, fontSize: 24, color: "var(--ink)", lineHeight: 1 }}>{companyViews}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>回</span></div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>求人（全求人の合計）</div>
                <div style={{ ...num, fontSize: 24, color: "var(--ink)", lineHeight: 1 }}>{jobViews}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>回</span></div>
              </div>
            </div>
            {trendEmpty ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>この期間の閲覧はまだありません。</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, color: "var(--ink-soft)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--royal)" }} />企業ページ</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--royal-100)" }} />求人</span>
                  <span style={{ marginLeft: "auto", color: "var(--ink-mute)" }}>{period === "all" ? "月ごと" : "日ごと"}</span>
                </div>
                {/* ⚠️ 積み上げの棒。日ごと90本でも縮むように minmax(0, 1fr) */}
                <div role="img" aria-label={trend.filter((t) => t.company + t.job > 0).map((t) => `${t.key} 企業ページ${t.company}回 求人${t.job}回`).join("、")}
                  style={{ display: "grid", gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))`, gap: trend.length > 40 ? 1 : 3, alignItems: "end", height: 120 }}>
                  {trend.map((t) => (
                    <div key={t.key} title={`${t.key}：企業ページ ${t.company}回・求人 ${t.job}回`}
                      style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{ height: `${(t.job / trendMax) * 100}%`, minHeight: t.job > 0 ? 2 : 0, background: "var(--royal-100)" }} />
                      <div style={{ height: `${(t.company / trendMax) * 100}%`, minHeight: t.company > 0 ? 2 : 0, background: "var(--royal)" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
                  <span>{fmtTrendKey(trend[0].key)}</span>
                  <span>{fmtTrendKey(trend[trend.length - 1].key)}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── 2つのファネル ── */}
      <div className="an-funnels" style={{ marginBottom: 16 }}>
        <div style={card}>
          <SectionTitle note={`${periodLabel}に届いた申込みが、いまどこまで進んでいるか`}>カジュアル面談</SectionTitle>
          {!meetingsRes.ok ? <Failed /> : meetings.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>この期間に届いた面談の申込みはありません。</p>
          ) : (
            <Funnel steps={meetingSteps} drop={{ label: "辞退", count: count(meetings, ["declined"]) }} />
          )}
        </div>
        <div style={card}>
          <SectionTitle note={`${periodLabel}に届いた応募が、いまどこまで進んでいるか`}>応募・選考</SectionTitle>
          {!appsRes.ok ? <Failed /> : apps.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>この期間に届いた応募はありません。</p>
          ) : (
            <Funnel steps={appSteps} drop={{ label: "不合格", count: count(apps, ["rejected"]) }} />
          )}
        </div>
      </div>

      {/* ── 月ごとの推移 ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <SectionTitle note="直近6か月。期間の切り替えには連動しません">月ごとの推移</SectionTitle>
        {!meetingsRes.ok || !appsRes.ok ? <Failed /> : monthlyEmpty ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>直近6か月に面談の申込み・応募はまだありません。</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12, color: "var(--ink-soft)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--royal)" }} />面談の申込み</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--royal-100)" }} />応募</span>
            </div>
            <div role="img" aria-label={monthly.map((m) => `${Number(m.month.slice(5))}月 面談${m.meetings}件 応募${m.apps}件`).join("、")}
              style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, alignItems: "end", height: 160 }}>
              {monthly.map((m) => (
                <div key={m.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
                    {[{ v: m.meetings, c: "var(--royal)" }, { v: m.apps, c: "var(--royal-100)" }].map((b, i) => (
                      <div key={i} style={{ width: "32%", maxWidth: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                        {b.v > 0 && <span style={{ ...num, fontSize: 11, color: "var(--ink-soft)", marginBottom: 2 }}>{b.v}</span>}
                        <div style={{ width: "100%", height: `${(b.v / monthlyMax) * 100}%`, minHeight: b.v > 0 ? 3 : 0, background: b.c, borderRadius: "3px 3px 0 0" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>{Number(m.month.slice(5))}月</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── 求人ごと ──
             ⚠️ 面談申込・応募は求人管理のカードと同じ数字（`countByJob`。全期間・検証用を除く） */}
      <div style={card}>
        <SectionTitle note="全期間。面談の申込みは辞退を除いた数。検証用アカウントは含みません。閲覧は 2026年10月9日からの記録">求人ごとの反応</SectionTitle>
        {jobs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>求人がまだありません。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} aria-label="求人ごとの閲覧数・面談申込数・応募数・保存数">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["求人", "状態", "閲覧", "面談申込", "応募", "保存"].map((h, i) => (
                    <th key={h} scope="col" style={{
                      padding: "8px 12px", textAlign: i >= 2 ? "right" : "left",
                      fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "11px 12px", maxWidth: 360 }}>
                      <Link href={`/biz/jobs/${j.id}/edit`} title={j.title}
                        style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)", fontWeight: 600, textDecoration: "none" }}>
                        {j.title}
                      </Link>
                    </td>
                    <td style={{ padding: "11px 12px", whiteSpace: "nowrap", fontSize: 12, color: "var(--ink-soft)" }}>{JOB_STATUS_LABEL[j.status ?? ""] ?? "—"}</td>
                    <td style={{ ...num, fontWeight: 600, padding: "11px 12px", color: "var(--ink)", textAlign: "right" }}>{viewsRes.ok ? (jobViewCounts[j.id] ?? 0) : "—"}</td>
                    <td style={{ ...num, fontWeight: 600, padding: "11px 12px", color: "var(--ink)", textAlign: "right" }}>{meetingsRes.ok ? (jobMeetingCounts[j.id] ?? 0) : "—"}</td>
                    <td style={{ ...num, fontWeight: 600, padding: "11px 12px", color: "var(--ink)", textAlign: "right" }}>{appsRes.ok ? (jobAppCounts[j.id] ?? 0) : "—"}</td>
                    <td style={{ ...num, fontWeight: 600, padding: "11px 12px", color: "var(--ink)", textAlign: "right" }}>
                      {savesRes.ok ? (jobSaveCounts[j.id] ?? 0) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}
    </BusinessLayout>
  );
}

/* ⚠️ 状態の色分けはしない（求人管理のバッジが担う）。ここは数字を読む表なので文字だけ */
const JOB_STATUS_LABEL: Record<string, string> = {
  published: "公開中",
  pending_review: "審査中",
  draft: "下書き",
  private: "非公開",
  rejected: "差し戻し",
};

/** 推移の端に出す日付。「YYYY-MM-DD」→「M/D」、「YYYY-MM」→「YYYY年M月」 */
function fmtTrendKey(k: string): string {
  return k.length === 10 ? `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}` : `${k.slice(0, 4)}年${Number(k.slice(5, 7))}月`;
}
