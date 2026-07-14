"use client";

import { useState, useTransition } from "react";

interface Report {
  id: string;
  company_id: string;
  user_id: string;
  role_id: string;
  annual_salary: number;
  years_of_experience: number | null;
  employment_status: string;
  prefecture: string | null;
  is_approved: boolean;
  is_flagged: boolean;
  created_at: string;
  company_name: string | null;
  role_name: string | null;
  user_name: string | null;
}

function fmt(yen: number) {
  return `${Math.round(yen / 10000)}万円`;
}

export default function SalaryReportsAdminClient({ reports: initial }: { reports: Report[] }) {
  const [reports, setReports] = useState<Report[]>(initial);
  const [filter, setFilter] = useState<"all" | "pending" | "flagged">("pending");
  const [, startTransition] = useTransition();

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/salary-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return alert("更新に失敗しました");
    startTransition(() => {
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, ...body } : r));
    });
  }

  async function del(id: string) {
    if (!confirm("このデータを削除しますか？")) return;
    await fetch(`/api/admin/salary-reports/${id}`, { method: "DELETE" });
    startTransition(() => {
      setReports((prev) => prev.filter((r) => r.id !== id));
    });
  }

  const displayed = reports.filter((r) => {
    if (filter === "pending") return !r.is_approved;
    if (filter === "flagged") return r.is_flagged;
    return true;
  });

  const pendingCount = reports.filter((r) => !r.is_approved).length;
  const flaggedCount = reports.filter((r) => r.is_flagged).length;

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          ["pending", `承認待ち (${pendingCount})`],
          ["flagged", `フラグあり (${flaggedCount})`],
          ["all", `全件 (${reports.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              background: filter === key ? "var(--royal)" : "#fff",
              color: filter === key ? "#fff" : "var(--ink-soft)",
              borderColor: filter === key ? "var(--royal)" : "var(--line)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink-mute)", fontSize: 14 }}>
          該当するデータはありません
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {displayed.map((r) => (
          <div
            key={r.id}
            style={{
              background: r.is_flagged ? "#FEF3C7" : "#fff",
              border: `1px solid ${r.is_flagged ? "#FCD34D" : "var(--line)"}`,
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {r.is_flagged && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#FDE68A", color: "#92400E", padding: "2px 7px", borderRadius: 100 }}>
                      ⚠ 要確認
                    </span>
                  )}
                  {r.is_approved ? (
                    <span style={{ fontSize: 10, fontWeight: 700, background: "var(--success-soft)", color: "var(--success)", padding: "2px 7px", borderRadius: 100 }}>
                      ✓ 承認済み
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, background: "var(--line-soft)", color: "var(--ink-mute)", padding: "2px 7px", borderRadius: 100 }}>
                      承認待ち
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {r.company_name ?? "不明な企業"} — {r.role_name ?? "不明な職種"}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
                  {fmt(r.annual_salary)}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-soft)" }}>
                  {r.employment_status === "current" ? "現役" : "OB/OG"}
                  {r.years_of_experience != null && <span>経験 {r.years_of_experience}年</span>}
                  {r.prefecture && <span>{r.prefecture}</span>}
                  <span>投稿者: {r.user_name ?? "不明"}</span>
                  <span>{new Date(r.created_at).toLocaleDateString("ja-JP")}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 120 }}>
                {!r.is_approved ? (
                  <button
                    onClick={() => patch(r.id, { is_approved: true, is_flagged: false })}
                    style={{ padding: "7px 14px", background: "var(--success)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    承認する
                  </button>
                ) : (
                  <button
                    onClick={() => patch(r.id, { is_approved: false })}
                    style={{ padding: "7px 14px", background: "var(--line-soft)", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
                  >
                    承認取消
                  </button>
                )}
                {r.is_flagged && (
                  <button
                    onClick={() => patch(r.id, { is_flagged: false })}
                    style={{ padding: "7px 14px", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                  >
                    フラグ解除
                  </button>
                )}
                <button
                  onClick={() => del(r.id)}
                  style={{ padding: "7px 14px", background: "var(--error-soft)", color: "var(--error)", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
