"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BizJob, JobStatus } from "@/lib/business/mockJobs";
import { JOB_STATUS_TABS, countByStatus } from "@/lib/business/mockJobs";
import { JobStatusSummary } from "@/components/business/JobStatusSummary";
import { JobListCard } from "@/components/business/JobListCard";
import { JobsEmptyState } from "@/components/business/JobsEmptyState";

type Props = {
  jobs: BizJob[];
  isAdmin?: boolean;
};

export function JobsClient({ jobs: initialJobs, isAdmin = true }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<BizJob[]>(initialJobs);
  const [activeStatus, setActiveStatus] = useState<JobStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleStatusChange = useCallback(async (jobId: string, newStatus: JobStatus) => {
    const old = jobs.find((j) => j.id === jobId);
    // optimistic update
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: newStatus } : j));

    if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") return;

    const res = await fetch(`/api/biz/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", value: newStatus }),
    });
    if (!res.ok && old) {
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: old.status } : j));
      showError("ステータス更新に失敗しました。再度お試しください。");
    }
  }, [jobs]);

  const handleDelete = useCallback(async (jobId: string) => {
    // Show inline confirmation instead of window.confirm
    setPendingDeleteId(jobId);
  }, []);

  const confirmDelete = useCallback(async (jobId: string) => {
    setPendingDeleteId(null);
    const snapshot = jobs;
    // optimistic remove
    setJobs((prev) => prev.filter((j) => j.id !== jobId));

    if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") return;

    const res = await fetch(`/api/biz/jobs/${jobId}`, { method: "DELETE" });
    if (!res.ok) {
      setJobs(snapshot);
      showError("削除に失敗しました。再度お試しください。");
    }
  }, [jobs]);

  const handleDuplicate = useCallback(async (jobId: string) => {
    if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
      showError("複製機能はモックモードでは動作しません。");
      return;
    }
    const res = await fetch("/api/biz/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: jobId }),
    });
    if (!res.ok) { showError("複製に失敗しました。再度お試しください。"); return; }
    const { id } = await res.json() as { id: string };
    router.push(`/biz/jobs/${id}/edit`);
  }, [router]);

  const counts = useMemo(() => countByStatus(jobs), [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (activeStatus !== "all" && j.status !== activeStatus) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.jobCategory.toLowerCase().includes(q) ||
        (j.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, activeStatus, searchQuery]);

  const hasFilters = activeStatus !== "all" || !!searchQuery.trim();

  return (
    <div>
      {/* エラーバナー */}
      {errorMessage && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error)", fontWeight: 600,
        }}>
          <span>⚠ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--error)", fontSize: 16, padding: "0 4px",
          }}>×</button>
        </div>
      )}

      {/* ページヘッダー */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontWeight: 500,
            fontSize: 26,
            color: "var(--ink)",
            letterSpacing: "0.02em",
            marginBottom: 6,
          }}>
            求人管理
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            求人の作成・編集・公開状態を管理します。新規求人は「公開申請」後にOPINIO運営の審査（2-3営業日）を経て公開されます。
          </p>
        </div>
        {isAdmin && (
        <Link
          href="/biz/jobs/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            background: "var(--royal)",
            color: "#fff",
            border: "1px solid var(--royal)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            flexShrink: 0,
            marginLeft: 24,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新規求人を作成
        </Link>
        )}
      </div>

      {/* ステータスサマリー */}
      <JobStatusSummary
        counts={counts}
        activeStatus={activeStatus}
        onStatusClick={setActiveStatus}
      />

      {/* フィルタバー */}
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        {/* ステータスタブ */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {JOB_STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.status;
            const isRejected = tab.status === "rejected";
            return (
              <button
                key={tab.status}
                onClick={() => setActiveStatus(tab.status)}
                aria-pressed={isActive}
                style={{
                  padding: "7px 13px",
                  background: isActive ? "var(--royal)" : "#fff",
                  border: `1px solid ${isActive ? "var(--royal)" : isRejected && counts.rejected > 0 ? "#FCA5A5" : "var(--line)"}`,
                  borderRadius: 100,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  color: isActive ? "#fff" : isRejected && counts.rejected > 0 ? "var(--error)" : "var(--ink-soft)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s",
                }}
              >
                {tab.labelJa}
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10, fontWeight: 700,
                  opacity: 0.8,
                }}>
                  {counts[tab.status]}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* 検索ボックス */}
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute",
            left: 11,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink-mute)",
            pointerEvents: "none",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.3-4.3"/>
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="求人タイトル・職種で検索..."
            aria-label="求人を検索"
            style={{
              padding: searchQuery ? "7px 32px 7px 32px" : "7px 12px 7px 32px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 12,
              background: "#fff",
              width: 240,
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="検索をクリア"
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2,
                display: "flex", alignItems: "center",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 求人リスト */}
      {(hasFilters || searchQuery) && filtered.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 4, textAlign: "right" }}>
          {filtered.length} 件の求人
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <JobsEmptyState hasFilters={hasFilters} />
        ) : (
          filtered.map((job) => (
            <div key={job.id}>
              <JobListCard
                job={job}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
              {/* Inline delete confirmation */}
              {pendingDeleteId === job.id && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 18px", borderRadius: "0 0 10px 10px",
                  background: "#FFF5F5", border: "1px solid #FCA5A5", borderTop: "none",
                  fontSize: 13,
                }}>
                  <span style={{ color: "var(--error)", fontWeight: 600 }}>
                    この求人を削除しますか？この操作は取り消せません。
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setPendingDeleteId(null)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--line)", background: "#fff",
                        color: "var(--ink-soft)", cursor: "pointer",
                      }}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => confirmDelete(job.id)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--error)", background: "var(--error)",
                        color: "#fff", cursor: "pointer",
                      }}
                    >
                      削除する
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
