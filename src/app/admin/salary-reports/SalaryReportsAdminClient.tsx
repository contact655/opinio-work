"use client";

import { useState } from "react";

type SalaryReport = {
  id: string;
  company_id: string;
  job_type: string;
  years_of_experience: number | null;
  annual_salary: number;
  employment_status: "current" | "alumni";
  is_approved: boolean;
  created_at: string;
  ow_companies: { id: string; name: string } | null;
  ow_users: { name: string } | null;
};

function formatSalary(yen: number): string {
  const man = Math.round(yen / 10000);
  return `${man.toLocaleString()}万円`;
}

function salaryColor(yen: number): string {
  // 外れ値を色で警告: 500万未満=赤寄り、2000万超=紫
  if (yen < 5000000) return "#DC2626";
  if (yen > 20000000) return "#7C3AED";
  return "var(--success)";
}

export default function SalaryReportsAdminClient({ initialReports }: { initialReports: SalaryReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = reports.filter(r =>
    filter === "all" ? true : filter === "pending" ? !r.is_approved : r.is_approved
  );

  const pendingCount = reports.filter(r => !r.is_approved).length;
  const approvedCount = reports.filter(r => r.is_approved).length;

  async function approve(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/salary-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_approved: true }),
    });
    if (res.ok) setReports(prev => prev.map(r => r.id === id ? { ...r, is_approved: true } : r));
    setLoading(null);
  }

  async function unapprove(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/salary-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_approved: false }),
    });
    if (res.ok) setReports(prev => prev.map(r => r.id === id ? { ...r, is_approved: false } : r));
    setLoading(null);
  }

  async function deleteReport(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/salary-reports/${id}`, { method: "DELETE" });
    if (res.ok) setReports(prev => prev.filter(r => r.id !== id));
    setLoading(null);
    setConfirmDelete(null);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>給与レポート審査</h1>
        {pendingCount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 99, background: "var(--error)", color: "#fff" }}>
            未承認 {pendingCount}件
          </span>
        )}
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-soft)" }}>
        承認すると企業詳細ページの給与データに反映されます。
        <span style={{ color: "#DC2626", fontWeight: 600 }}>赤字</span>は500万未満、
        <span style={{ color: "#7C3AED", fontWeight: 600 }}>紫字</span>は2000万超の外れ値です。
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          { key: "pending" as const, label: `未承認 (${pendingCount})` },
          { key: "approved" as const, label: `承認済み (${approvedCount})` },
          { key: "all" as const, label: "すべて" },
        ]).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 13,
            fontWeight: filter === key ? 700 : 400,
            border: `1.5px solid ${filter === key ? "var(--royal)" : "var(--line)"}`,
            background: filter === key ? "var(--royal-50)" : "#fff",
            color: filter === key ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-mute)" }}>
          {filter === "pending" ? "✅ 未承認の給与レポートはありません" : "給与レポートがありません"}
        </div>
      )}

      {/* テーブル形式で表示 */}
      {filtered.length > 0 && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--line-soft)" }}>
                {["企業名", "職種", "経験年数", "年収", "在籍", "投稿者", "日付", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                  background: r.is_approved ? "#fff" : "#FFFBEB",
                }}>
                  <td style={{ padding: "12px 14px" }}>
                    <a href={`/companies/${r.company_id}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontWeight: 700, color: "var(--royal)", textDecoration: "none", fontSize: 13 }}>
                      {r.ow_companies?.name ?? "企業不明"}
                    </a>
                    {r.is_approved && (
                      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "var(--success-soft)", color: "var(--success)", fontWeight: 700 }}>
                        公開中
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--ink-soft)" }}>{r.job_type}</td>
                  <td style={{ padding: "12px 14px", color: "var(--ink-soft)", textAlign: "center" }}>
                    {r.years_of_experience != null ? `${r.years_of_experience}年` : "—"}
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 15, color: salaryColor(r.annual_salary), whiteSpace: "nowrap" }}>
                    {formatSalary(r.annual_salary)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      fontSize: 11, padding: "1px 7px", borderRadius: 99,
                      background: r.employment_status === "current" ? "var(--royal-50)" : "var(--line-soft)",
                      color: r.employment_status === "current" ? "var(--royal)" : "var(--ink-soft)",
                    }}>
                      {r.employment_status === "current" ? "現役" : "OB/OG"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--ink-soft)" }}>
                    {r.ow_users?.name ?? "不明"}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {!r.is_approved ? (
                        <button onClick={() => approve(r.id)} disabled={loading === r.id}
                          style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "var(--success)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: loading === r.id ? 0.6 : 1, whiteSpace: "nowrap" }}>
                          {loading === r.id ? "..." : "承認"}
                        </button>
                      ) : (
                        <button onClick={() => unapprove(r.id)} disabled={loading === r.id}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid var(--ink-mute)", background: "#fff", color: "var(--ink-soft)", fontSize: 12, cursor: "pointer", opacity: loading === r.id ? 0.6 : 1, whiteSpace: "nowrap" }}>
                          {loading === r.id ? "..." : "取消"}
                        </button>
                      )}

                      {confirmDelete === r.id ? (
                        <>
                          <button onClick={() => deleteReport(r.id)} disabled={loading === r.id}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--error)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            削除
                          </button>
                          <button onClick={() => setConfirmDelete(null)}
                            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 11, cursor: "pointer", color: "var(--ink-soft)" }}>
                            戻る
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(r.id)}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--error)", background: "#fff", color: "var(--error)", fontSize: 12, cursor: "pointer" }}>
                          削除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
