import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:           { label: "申込待ち",     bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  company_contacted: { label: "企業連絡済み", bg: "#EFF3FC", color: "var(--royal)", border: "#DCE5F7" },
  scheduled:         { label: "日程確定",     bg: "#F3E8FF", color: "#7C3AED",       border: "#E9D5FF" },
  completed:         { label: "完了",         bg: "#F1F5F9", color: "#6b7280",       border: "#E2E8F0" },
  declined:          { label: "辞退/不採択",  bg: "#FEE2E2", color: "#DC2626",       border: "#FECACA" },
};

type Meeting = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyName: string | null;
  jobTitle: string | null;
  intent: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
};

async function getMeetings(): Promise<Meeting[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_casual_meetings")
    .select(`
      id,
      user_id,
      company_id,
      job_id,
      intent,
      status,
      created_at,
      completed_at,
      assignee_user_id,
      user:ow_users!user_id(name, email),
      company:ow_companies!company_id(name),
      job:ow_jobs!job_id(title),
      assignee:ow_users!assignee_user_id(name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[admin/meetings]", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    userId: row.user_id as string | null,
    userName: (row.user as { name: string | null } | null)?.name ?? null,
    userEmail: (row.user as { email: string | null } | null)?.email ?? null,
    companyId: row.company_id as string | null,
    companyName: (row.company as { name: string | null } | null)?.name ?? null,
    jobTitle: (row.job as { title: string | null } | null)?.title ?? null,
    intent: row.intent as string | null,
    status: (row.status as string) ?? "pending",
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | null,
    assigneeUserId: row.assignee_user_id as string | null,
    assigneeName: (row.assignee as { name: string | null } | null)?.name ?? null,
  }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

type AssigneeStat = {
  userId: string;
  name: string;
  companyName: string | null;
  total: number;
  completed: number;
  thisMonthCompleted: number;
};

export default async function AdminMeetingsPage() {
  const meetings = await getMeetings();

  const counts = {
    pending: meetings.filter((m) => m.status === "pending").length,
    scheduled: meetings.filter((m) => m.status === "scheduled").length,
    completed: meetings.filter((m) => m.status === "completed").length,
    total: meetings.length,
  };

  // 担当者別集計
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const assigneeMap = new Map<string, AssigneeStat>();
  for (const m of meetings) {
    if (!m.assigneeUserId || !m.assigneeName) continue;
    if (!assigneeMap.has(m.assigneeUserId)) {
      assigneeMap.set(m.assigneeUserId, {
        userId: m.assigneeUserId,
        name: m.assigneeName,
        companyName: m.companyName,
        total: 0,
        completed: 0,
        thisMonthCompleted: 0,
      });
    }
    const s = assigneeMap.get(m.assigneeUserId)!;
    s.total += 1;
    if (m.status === "completed") {
      s.completed += 1;
      if (m.completedAt && m.completedAt >= monthStart) s.thisMonthCompleted += 1;
    }
  }
  const assigneeStats = Array.from(assigneeMap.values()).sort((a, b) => b.total - a.total);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            background: "#DC2626", color: "#fff", padding: "3px 8px", borderRadius: 4,
          }}>ADMIN</span>
          <h1 style={{
            fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
            fontSize: 22, fontWeight: 600, color: "#0F172A", margin: 0,
          }}>面談管理</h1>
        </div>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
          ユーザーから企業へのカジュアル面談申込の一覧です。
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "総申込数",   value: counts.total,     color: "var(--royal)",   bg: "#EFF3FC" },
          { label: "申込待ち",   value: counts.pending,   color: "#B45309",        bg: "#FEF3C7" },
          { label: "日程確定",   value: counts.scheduled, color: "#7C3AED",        bg: "#F3E8FF" },
          { label: "完了",       value: counts.completed, color: "var(--success)", bg: "#ECFDF5" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
            padding: "20px 22px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "14px 14px 0 0" }} />
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 34, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
              {value}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{label}</div>
            <div style={{ height: 4, background: bg, borderRadius: 2, marginTop: 10 }} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
        {meetings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
            <p style={{ fontSize: 14, margin: 0 }}>面談申込はまだありません</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["申込日", "申込ユーザー", "申込先企業", "求人", "意向", "ステータス"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "10px 16px",
                    fontSize: 10, fontWeight: 700, color: "#94A3B8",
                    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => {
                const st = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                    {/* 申込日 */}
                    <td style={{ padding: "12px 16px", color: "#94A3B8", fontFamily: "Inter, sans-serif", fontSize: 12, whiteSpace: "nowrap" }}>
                      {formatDate(m.createdAt)}
                    </td>

                    {/* 申込ユーザー */}
                    <td style={{ padding: "12px 16px" }}>
                      {m.userId ? (
                        <Link href={`/u/${m.userId}`} target="_blank" style={{ fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>
                          {m.userName ?? "名前なし"}
                        </Link>
                      ) : (
                        <span style={{ color: "#94A3B8" }}>—</span>
                      )}
                      {m.userEmail && (
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{m.userEmail}</div>
                      )}
                    </td>

                    {/* 申込先企業 */}
                    <td style={{ padding: "12px 16px" }}>
                      {m.companyId ? (
                        <Link href={`/companies/${m.companyId}`} target="_blank" style={{ fontWeight: 600, color: "#0F172A", textDecoration: "none" }}>
                          {m.companyName ?? "—"}
                        </Link>
                      ) : (
                        <span style={{ color: "#94A3B8" }}>—</span>
                      )}
                    </td>

                    {/* 求人 */}
                    <td style={{ padding: "12px 16px", color: "#475569", maxWidth: 200 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {m.jobTitle ?? "—"}
                      </span>
                    </td>

                    {/* 意向 */}
                    <td style={{ padding: "12px 16px", color: "#475569", maxWidth: 220 }}>
                      <span style={{
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                        lineHeight: 1.4,
                      }}>
                        {m.intent ?? "—"}
                      </span>
                    </td>

                    {/* ステータス */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
                        background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                        whiteSpace: "nowrap",
                      }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 担当者別集計 */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 14, marginTop: 0 }}>
          担当者別 面談実績
        </h2>
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
          {assigneeStats.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
              <p style={{ fontSize: 13, margin: 0 }}>まだ面談データがありません。</p>
              <p style={{ fontSize: 12, margin: "4px 0 0", color: "#CBD5E1" }}>
                面談が申し込まれ担当者が設定されると自動で集計されます。
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["担当者", "所属企業", "担当件数", "完了件数", "今月完了"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "10px 16px",
                      fontSize: 10, fontWeight: 700, color: "#94A3B8",
                      letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assigneeStats.map((s) => (
                  <tr key={s.userId} style={{ borderBottom: "1px solid #F8FAFC" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0F172A" }}>
                      <Link href={`/u/${s.userId}`} target="_blank" style={{ color: "var(--royal)", textDecoration: "none" }}>
                        {s.name}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>{s.companyName ?? "—"}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "Inter, sans-serif", fontWeight: 700, color: "#0F172A" }}>
                      {s.total}件
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {s.completed > 0 ? (
                        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, color: "#059669" }}>
                          {s.completed}件
                        </span>
                      ) : <span style={{ color: "#CBD5E1" }}>0件</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {s.thisMonthCompleted > 0 ? (
                        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, color: "#B45309" }}>
                          {s.thisMonthCompleted}件
                        </span>
                      ) : <span style={{ color: "#CBD5E1" }}>0件</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
