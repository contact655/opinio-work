"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { approveJob, rejectJob, privateJob, republishJob } from "./actions";

// DB status values (migration 113 適用前は "active"、適用後は "published")
const STATUS_TABS = [
  { key: "all",            label: "すべて" },
  { key: "pending_review", label: "審査待ち" },
  { key: "published",      label: "公開中" },
  { key: "draft",          label: "下書き" },
  { key: "rejected",       label: "差し戻し済み" },
  { key: "private",        label: "非公開" },
];

const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート可",
  hybrid:      "ハイブリッド",
  on_site:     "原則出社",
};

type Job = {
  id: string;
  title: string | null;
  status: string | null;
  job_category: string | null;
  /** ⚠️ ow_roles は多対一なので実行時はオブジェクトだが、生成型では配列になる。両方受ける */
  ow_job_roles?: { is_primary: boolean; ow_roles: { name: string } | { name: string }[] | null }[] | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  remote_work_status: string | null;
  work_style: string | null;
  rejection_reason: string | null;
  rejection_reviewer: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  ow_companies: { name: string } | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending_review: { label: "審査待ち",   cls: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  published:      { label: "公開中",     cls: "bg-green-100 text-green-700 border border-green-200" },
  active:         { label: "公開中(旧)", cls: "bg-green-100 text-green-700 border border-green-200" },
  draft:          { label: "下書き",     cls: "bg-gray-100 text-gray-600 border border-gray-200" },
  rejected:       { label: "差し戻し",   cls: "bg-red-100 text-red-600 border border-red-200" },
  private:        { label: "非公開",     cls: "bg-slate-100 text-slate-500 border border-slate-200" },
};

/** 標準職種名。主ロール優先、無ければ先頭 */
function standardRoleName(j: Job): string | null {
  const rows = j.ow_job_roles ?? [];
  const primary = rows.find((r) => r.is_primary) ?? rows[0];
  const role = Array.isArray(primary?.ow_roles) ? primary?.ow_roles[0] : primary?.ow_roles;
  return role?.name ?? null;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 差し戻しモーダル state
  const [rejectTarget, setRejectTarget] = useState<Job | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionReviewer, setRejectionReviewer] = useState("OPINIO編集部");

  const loadJobs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("ow_jobs")
      /* ⚠️ 職種の表示は標準職種名（ow_job_roles の主ロール）。運営面では会社呼称を使わない。
            会社ごとに違う名前で並ぶと、職種を横断して見られなくなる。
         ⚠️ job_category は下のキーワード検索が使っているので SELECT からは外さない。 */
      .select("id, title, status, job_category, salary_min, salary_max, location, remote_work_status, work_style, rejection_reason, rejection_reviewer, submitted_at, created_at, updated_at, ow_companies(name), ow_job_roles!job_id(is_primary, ow_roles!role_id(name))")
      .order("updated_at", { ascending: false });
    setJobs((data as unknown as Job[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // 承認: status → "published", published_at = now
  async function handleApprove(job: Job) {
    setActionLoading(job.id);
    await approveJob(job.id);
    setJobs((prev) =>
      prev.map((j) => j.id === job.id ? { ...j, status: "published" } : j)
    );
    setActionLoading(null);
  }

  // 差し戻し確定
  async function handleRejectConfirm() {
    if (!rejectTarget || !rejectionReason.trim()) return;
    setActionLoading(rejectTarget.id);
    await rejectJob(rejectTarget.id, rejectionReason.trim(), rejectionReviewer.trim());
    setJobs((prev) =>
      prev.map((j) =>
        j.id === rejectTarget!.id
          ? { ...j, status: "rejected", rejection_reason: rejectionReason.trim() }
          : j
      )
    );
    setRejectTarget(null);
    setRejectionReason("");
    setActionLoading(null);
  }

  // 非公開化
  async function handlePrivate(job: Job) {
    setActionLoading(job.id);
    await privateJob(job.id);
    setJobs((prev) =>
      prev.map((j) => j.id === job.id ? { ...j, status: "private" } : j)
    );
    setActionLoading(null);
  }

  // 再公開 (private → published)
  async function handleRepublish(job: Job) {
    setActionLoading(job.id);
    await republishJob(job.id);
    setJobs((prev) =>
      prev.map((j) => j.id === job.id ? { ...j, status: "published" } : j)
    );
    setActionLoading(null);
  }

  // "active" は "published" 相当として扱う（migration 113 適用前の互換）
  const normalizedStatus = (s: string | null) =>
    s === "active" ? "published" : (s ?? "draft");

  const filtered = jobs.filter((j) => {
    if (activeTab !== "all" && normalizedStatus(j.status) !== activeTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (j.title ?? "").toLowerCase().includes(q) ||
        (j.ow_companies?.name ?? "").toLowerCase().includes(q) ||
        (j.job_category ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = jobs.filter((j) => j.status === "pending_review").length;

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="skeleton-shimmer" style={{ height: 32, borderRadius: 8, maxWidth: 300, marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>求人審査</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            企業から申請された求人を審査・承認します
          </p>
        </div>
        {pendingCount > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "6px 14px",
            background: "#FEF3C7",
            color: "#92400E",
            border: "1px solid #FCD34D",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 600,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{pendingCount}件の審査待ち
          </span>
        )}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="求人タイトル・企業名・職種で検索..."
          aria-label="求人を検索"
          style={{
            width: "100%", padding: "9px 36px 9px 36px",
            border: "1.5px solid #E2E8F0", borderRadius: 8,
            fontSize: 13, color: "#0F172A", background: "#fff",
            outline: "none", boxSizing: "border-box",
            fontFamily: "inherit", transition: "border-color 0.15s",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; }}
          onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="検索をクリア"
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "#94A3B8", fontSize: 16, lineHeight: 1, padding: "2px 4px",
            }}
          ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        )}
      </div>

      {/* Status Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }} role="tablist" aria-label="求人ステータスで絞り込み">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all"
            ? jobs.length
            : jobs.filter((j) => normalizedStatus(j.status) === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 100,
                border: `1px solid ${activeTab === tab.key ? "var(--royal)" : "#E2E8F0"}`,
                background: activeTab === tab.key ? "var(--royal)" : "#fff",
                color: activeTab === tab.key ? "#fff" : "#475569",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 100,
                background: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#F1F5F9",
                color: activeTab === tab.key ? "#fff" : "#6b7280",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["求人タイトル", "企業名", "職種", "年収（万円）", "勤務地", "働き方", "ステータス", "申請日", "操作"].map((h) => (
                <th key={h} scope="col" style={{
                  textAlign: "left", padding: "10px 14px",
                  fontSize: 11, color: "#6b7280", fontWeight: 600,
                  letterSpacing: "0.04em", whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8", fontSize: 14 }}>
                  求人が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((j) => {
                const ns = normalizedStatus(j.status);
                const badge = STATUS_BADGE[j.status ?? "draft"] ?? STATUS_BADGE["draft"];
                const workStyle = (() => {
                  const raw = j.work_style ?? j.remote_work_status;
                  return raw ? (WORK_STYLE_LABELS[raw] ?? raw) : "—";
                })();
                return (
                  <tr key={j.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {/* タイトル */}
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0F172A", maxWidth: 220 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <Link href={`/admin/jobs/${j.id}`} style={{ color: "var(--royal)", textDecoration: "none" }}>
                          {j.title || "—"}
                        </Link>
                      </div>
                      {j.status === "rejected" && j.rejection_reason && (
                        <div style={{
                          marginTop: 4, fontSize: 11, color: "#EF4444",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          maxWidth: 220,
                        }}>
                          理由: {j.rejection_reason}
                        </div>
                      )}
                    </td>
                    {/* 企業名 */}
                    <td style={{ padding: "12px 14px", color: "#475569" }}>
                      {j.ow_companies?.name || "—"}
                    </td>
                    {/* 職種 */}
                    <td style={{ padding: "12px 14px", color: "#475569", whiteSpace: "nowrap" }}>
                      {standardRoleName(j) || "—"}
                    </td>
                    {/* 年収 */}
                    <td style={{ padding: "12px 14px", color: "#475569", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>
                      {j.salary_min || j.salary_max
                        ? `¥${j.salary_min ?? "?"}–${j.salary_max ?? "?"}万`
                        : "—"}
                    </td>
                    {/* 勤務地 */}
                    <td style={{ padding: "12px 14px", color: "#475569" }}>{j.location || "—"}</td>
                    {/* 働き方 */}
                    <td style={{ padding: "12px 14px", color: "#475569", whiteSpace: "nowrap" }}>{workStyle}</td>
                    {/* ステータス */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                      }} className={badge.cls}>
                        {badge.label}
                      </span>
                    </td>
                    {/* 申請日 */}
                    <td style={{ padding: "12px 14px", color: "#94A3B8", fontSize: 11, whiteSpace: "nowrap" }}>
                      {j.submitted_at
                        ? new Date(j.submitted_at).toLocaleDateString("ja-JP")
                        : new Date(j.created_at).toLocaleDateString("ja-JP")}
                    </td>
                    {/* 操作 */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {ns === "pending_review" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(j)}
                              disabled={actionLoading === j.id}
                              style={{
                                padding: "5px 12px", borderRadius: 6,
                                background: "var(--success)", border: "none",
                                color: "#fff", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", whiteSpace: "nowrap",
                                opacity: actionLoading === j.id ? 0.5 : 1,
                              }}
                            >
                              承認・公開
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRejectTarget(j); setRejectionReason(""); }}
                              disabled={actionLoading === j.id}
                              style={{
                                padding: "5px 12px", borderRadius: 6,
                                background: "#FEE2E2", border: "1px solid #FCA5A5",
                                color: "#DC2626", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", whiteSpace: "nowrap",
                                opacity: actionLoading === j.id ? 0.5 : 1,
                              }}
                            >
                              差し戻し
                            </button>
                          </>
                        )}
                        {(ns === "published") && (
                          <button
                            type="button"
                            onClick={() => handlePrivate(j)}
                            disabled={actionLoading === j.id}
                            style={{
                              padding: "5px 12px", borderRadius: 6,
                              background: "#F1F5F9", border: "1px solid #CBD5E1",
                              color: "#475569", fontSize: 12, fontWeight: 600,
                              cursor: "pointer", whiteSpace: "nowrap",
                              opacity: actionLoading === j.id ? 0.5 : 1,
                            }}
                          >
                            非公開化
                          </button>
                        )}
                        {ns === "rejected" && (
                          <button
                            type="button"
                            onClick={() => { setRejectTarget(j); setRejectionReason(j.rejection_reason ?? ""); }}
                            disabled={actionLoading === j.id}
                            style={{
                              padding: "5px 12px", borderRadius: 6,
                              background: "#F1F5F9", border: "1px solid #CBD5E1",
                              color: "#475569", fontSize: 12, fontWeight: 600,
                              cursor: "pointer", whiteSpace: "nowrap",
                              opacity: actionLoading === j.id ? 0.5 : 1,
                            }}
                          >
                            理由を編集
                          </button>
                        )}
                        {ns === "private" && (
                          <button
                            type="button"
                            onClick={() => handleRepublish(j)}
                            disabled={actionLoading === j.id}
                            style={{
                              padding: "5px 12px", borderRadius: 6,
                              background: "#EFF3FC", border: "1px solid #B2C4F0",
                              color: "var(--royal)", fontSize: 12, fontWeight: 600,
                              cursor: "pointer", whiteSpace: "nowrap",
                              opacity: actionLoading === j.id ? 0.5 : 1,
                            }}
                          >
                            再公開
                          </button>
                        )}
                        {ns === "draft" && (
                          <span style={{ fontSize: 12, color: "#CBD5E1" }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 差し戻しモーダル */}
      {rejectTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ajobs-reject-title"
            style={{
            background: "#fff", borderRadius: 16, padding: 28,
            width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h3 id="ajobs-reject-title" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
              差し戻し理由を入力
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              「{rejectTarget.title}」（{rejectTarget.ow_companies?.name}）
            </p>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="ajob-rejection-reason" style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                フィードバック内容（企業側に表示されます）
              </label>
              <textarea
                id="ajob-rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="例：「求める人物像」セクションに年齢・性別等の記述があります。男女雇用機会均等法に基づき修正をお願いします。"
                rows={5}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1px solid #CBD5E1", borderRadius: 8,
                  fontSize: 13, color: "#0F172A", resize: "vertical",
                  fontFamily: "inherit", boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="ajob-reviewer" style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                審査担当者名
              </label>
              <input
                id="ajob-reviewer"
                type="text"
                value={rejectionReviewer}
                onChange={(e) => setRejectionReviewer(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px",
                  border: "1px solid #CBD5E1", borderRadius: 8,
                  fontSize: 13, color: "#0F172A",
                  fontFamily: "inherit", boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => { setRejectTarget(null); setRejectionReason(""); }}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  border: "1px solid #E2E8F0", background: "#fff",
                  color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim() || actionLoading !== null}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  border: "none", background: "#DC2626",
                  color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: rejectionReason.trim() ? "pointer" : "not-allowed",
                  opacity: !rejectionReason.trim() || actionLoading !== null ? 0.5 : 1,
                }}
              >
                差し戻しを確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
