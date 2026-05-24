"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState("all");
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
      .select("id, title, status, job_category, salary_min, salary_max, location, remote_work_status, work_style, rejection_reason, rejection_reviewer, submitted_at, created_at, updated_at, ow_companies(name)")
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
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase
      .from("ow_jobs")
      .update({
        status: "published",
        published_at: now,
        updated_at: now,
        rejection_reason: null,
        rejection_reviewer: null,
        rejection_date: null,
      })
      .eq("id", job.id);
    setJobs((prev) =>
      prev.map((j) => j.id === job.id ? { ...j, status: "published" } : j)
    );
    setActionLoading(null);
  }

  // 差し戻し確定
  async function handleRejectConfirm() {
    if (!rejectTarget || !rejectionReason.trim()) return;
    setActionLoading(rejectTarget.id);
    const supabase = createClient();
    const now = new Date().toISOString();
    const dateLabel = new Date().toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric",
    });
    await supabase
      .from("ow_jobs")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
        rejection_reviewer: rejectionReviewer.trim() || "OPINIO編集部",
        rejection_date: dateLabel,
        updated_at: now,
      })
      .eq("id", rejectTarget.id);
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
    const supabase = createClient();
    await supabase
      .from("ow_jobs")
      .update({ status: "private", updated_at: new Date().toISOString() })
      .eq("id", job.id);
    setJobs((prev) =>
      prev.map((j) => j.id === job.id ? { ...j, status: "private" } : j)
    );
    setActionLoading(null);
  }

  // 再公開 (private → published)
  async function handleRepublish(job: Job) {
    setActionLoading(job.id);
    const supabase = createClient();
    await supabase
      .from("ow_jobs")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", job.id);
    setJobs((prev) =>
      prev.map((j) => j.id === job.id ? { ...j, status: "published" } : j)
    );
    setActionLoading(null);
  }

  // "active" は "published" 相当として扱う（migration 113 適用前の互換）
  const normalizedStatus = (s: string | null) =>
    s === "active" ? "published" : (s ?? "draft");

  const filtered = jobs.filter((j) => {
    if (activeTab === "all") return true;
    return normalizedStatus(j.status) === activeTab;
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
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
            企業から申請された求人を審査・承認します
          </p>
        </div>
        {pendingCount > 0 && (
          <span style={{
            padding: "6px 14px",
            background: "#FEF3C7",
            color: "#92400E",
            border: "1px solid #FCD34D",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 600,
          }}>
            ⚠ {pendingCount}件の審査待ち
          </span>
        )}
      </div>

      {/* Status Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all"
            ? jobs.length
            : jobs.filter((j) => normalizedStatus(j.status) === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 100,
                border: `1px solid ${activeTab === tab.key ? "#002366" : "#E2E8F0"}`,
                background: activeTab === tab.key ? "#002366" : "#fff",
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
                color: activeTab === tab.key ? "#fff" : "#64748B",
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
                <th key={h} style={{
                  textAlign: "left", padding: "10px 14px",
                  fontSize: 11, color: "#64748B", fontWeight: 600,
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
                        <Link href={`/admin/jobs/${j.id}`} style={{ color: "#002366", textDecoration: "none" }}>
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
                      {j.job_category || "—"}
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
                              onClick={() => handleApprove(j)}
                              disabled={actionLoading === j.id}
                              style={{
                                padding: "5px 12px", borderRadius: 6,
                                background: "#059669", border: "none",
                                color: "#fff", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", whiteSpace: "nowrap",
                                opacity: actionLoading === j.id ? 0.5 : 1,
                              }}
                            >
                              承認・公開
                            </button>
                            <button
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
                            onClick={() => handleRepublish(j)}
                            disabled={actionLoading === j.id}
                            style={{
                              padding: "5px 12px", borderRadius: 6,
                              background: "#EFF3FC", border: "1px solid #B2C4F0",
                              color: "#002366", fontSize: 12, fontWeight: 600,
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
          <div style={{
            background: "#fff", borderRadius: 16, padding: 28,
            width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
              差し戻し理由を入力
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
              「{rejectTarget.title}」（{rejectTarget.ow_companies?.name}）
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                フィードバック内容（企業側に表示されます）
              </label>
              <textarea
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
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                審査担当者名
              </label>
              <input
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
