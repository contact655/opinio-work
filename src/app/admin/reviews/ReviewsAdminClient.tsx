"use client";

import { useState } from "react";

type Review = {
  id: string;
  company_id: string;
  employment_status: "current" | "alumni";
  rating_overall: number;
  rating_culture: number | null;
  rating_growth: number | null;
  rating_wlb: number | null;
  rating_compensation: number | null;
  pros: string | null;
  cons: string | null;
  job_type: string | null;
  is_approved: boolean;
  created_at: string;
  ow_companies: { id: string; name: string } | null;
  ow_users: { name: string } | null;
};

function Stars({ value }: { value: number }) {
  return (
    <span style={{ letterSpacing: 1 }}>
      {"★".repeat(value)}
      <span style={{ color: "var(--line)" }}>{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function ReviewsAdminClient({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = reviews.filter(r =>
    filter === "all" ? true : filter === "pending" ? !r.is_approved : r.is_approved
  );

  const pendingCount = reviews.filter(r => !r.is_approved).length;
  const approvedCount = reviews.filter(r => r.is_approved).length;

  async function approve(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_approved: true }),
    });
    if (res.ok) setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: true } : r));
    setLoading(null);
  }

  async function unapprove(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_approved: false }),
    });
    if (res.ok) setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: false } : r));
    setLoading(null);
  }

  async function deleteReview(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    if (res.ok) setReviews(prev => prev.filter(r => r.id !== id));
    setLoading(null);
    setConfirmDelete(null);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>口コミ審査</h1>
        {pendingCount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 99, background: "var(--error)", color: "#fff" }}>
            未承認 {pendingCount}件
          </span>
        )}
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-soft)" }}>
        承認すると企業詳細ページに公開されます。投稿者名は管理者のみ確認可能（公開ページは匿名表示）。
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
          {filter === "pending" ? "✅ 未承認の口コミはありません" : "口コミがありません"}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(r => (
          <div key={r.id} style={{
            border: `1.5px solid ${r.is_approved ? "var(--line)" : "#FDE68A"}`,
            borderRadius: 14, padding: "18px 22px",
            background: r.is_approved ? "#fff" : "#FFFBEB",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <a href={`/companies/${r.company_id}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 15, fontWeight: 800, color: "var(--royal)", textDecoration: "none" }}>
                  {r.ow_companies?.name ?? "企業不明"}
                </a>
                <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, color: "#B45309" }}><Stars value={r.rating_overall} /></span>
                  <span style={{
                    fontSize: 11, padding: "1px 7px", borderRadius: 99,
                    background: r.employment_status === "current" ? "var(--royal-50)" : "var(--line-soft)",
                    color: r.employment_status === "current" ? "var(--royal)" : "var(--ink-soft)",
                  }}>
                    {r.employment_status === "current" ? "現役" : "OB/OG"}
                  </span>
                  {r.job_type && (
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", padding: "1px 7px", borderRadius: 99, background: "var(--line-soft)" }}>
                      {r.job_type}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                    投稿者: {r.ow_users?.name ?? "不明"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    {new Date(r.created_at).toLocaleDateString("ja-JP")}
                  </span>
                  {r.is_approved && (
                    <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 99, background: "var(--success-soft)", color: "var(--success)", fontWeight: 700 }}>
                      ✓ 公開中
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
                {!r.is_approved ? (
                  <button onClick={() => approve(r.id)} disabled={loading === r.id}
                    style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "var(--success)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading === r.id ? 0.6 : 1 }}>
                    {loading === r.id ? "処理中..." : "承認して公開"}
                  </button>
                ) : (
                  <button onClick={() => unapprove(r.id)} disabled={loading === r.id}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid var(--ink-mute)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, cursor: "pointer", opacity: loading === r.id ? 0.6 : 1 }}>
                    {loading === r.id ? "処理中..." : "承認取消"}
                  </button>
                )}

                {confirmDelete === r.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--error)", fontWeight: 600 }}>削除しますか？</span>
                    <button onClick={() => deleteReview(r.id)} disabled={loading === r.id}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "var(--error)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      削除
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 12, cursor: "pointer", color: "var(--ink-soft)" }}>
                      戻る
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(r.id)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--error)", background: "#fff", color: "var(--error)", fontSize: 13, cursor: "pointer" }}>
                    削除
                  </button>
                )}
              </div>
            </div>

            {(r.rating_culture || r.rating_growth || r.rating_wlb || r.rating_compensation) && (
              <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                {[
                  { label: "社風", v: r.rating_culture },
                  { label: "成長", v: r.rating_growth },
                  { label: "WLB", v: r.rating_wlb },
                  { label: "報酬", v: r.rating_compensation },
                ].filter(x => x.v).map(({ label, v }) => (
                  <span key={label} style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {label}: <span style={{ color: "#B45309" }}>{"★".repeat(v!)}{"☆".repeat(5 - v!)}</span>
                  </span>
                ))}
              </div>
            )}

            {r.pros && (
              <p style={{ margin: "0 0 6px", fontSize: 13, lineHeight: 1.7 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)" }}>👍 良い点</span>{" "}{r.pros}
              </p>
            )}
            {r.cons && (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--error)" }}>💡 改善点</span>{" "}{r.cons}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
