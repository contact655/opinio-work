"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BizJob, JobStatus } from "@/lib/business/mockJobs";
import { JOB_STATUS_TABS, countByStatus } from "@/lib/business/mockJobs";
import { JobListCard } from "@/components/business/JobListCard";
import { JobsEmptyState } from "@/components/business/JobsEmptyState";
import { FilterChip } from "@/components/common/FilterChip";

type Props = {
  jobs: BizJob[];
  isAdmin?: boolean;
  /** `?status=` 由来の初期タブ。⚠️ 検証済みの値だけが来る（page.tsx を参照） */
  initialStatus?: JobStatus | "all";
};

/* ★2026-09-21 に左の絞り込み欄（部門・職種・雇用形態・年収）をやめた（柴さん）。
      自社の求人は数件で、常時開きの欄は大きすぎた。残したのは状態のタブ・検索・職種の3つ。
   ⚠️ 部門はフリーワード検索に含めてある（部門名でも当たる）。
   ⚠️ 年収の絞り込みは**万円の値を円（×10000）と比べていて一度も正しく効いていなかった**。
      戻すなら単位を揃えること（`salaryMin` / `salaryMax` は万円）。 */

export function JobsClient({ jobs: initialJobs, isAdmin = true, initialStatus = "all" }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<BizJob[]>(initialJobs);
  const [activeStatus, setActiveStatus] = useState<JobStatus | "all">(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleStatusChange = useCallback(async (jobId: string, newStatus: JobStatus) => {
    const old = jobs.find((j) => j.id === jobId);
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: newStatus } : j));
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
    setPendingDeleteId(jobId);
  }, []);

  const confirmDelete = useCallback(async (jobId: string) => {
    setPendingDeleteId(null);
    const snapshot = jobs;
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    const res = await fetch(`/api/biz/jobs/${jobId}`, { method: "DELETE" });
    if (!res.ok) {
      setJobs(snapshot);
      showError("削除に失敗しました。再度お試しください。");
    }
  }, [jobs]);

  const handleDuplicate = useCallback(async (jobId: string) => {
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

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      (j.jobRoleNames ?? []).forEach((n) => set.add(n));
      if (j.jobCategory) set.add(j.jobCategory);
    });
    return Array.from(set).sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (activeStatus !== "all" && j.status !== activeStatus) return false;
      if (categoryFilter) {
        const roles = j.jobRoleNames ?? [];
        const matchesRole = roles.includes(categoryFilter);
        const matchesCategory = j.jobCategory === categoryFilter;
        if (!matchesRole && !matchesCategory) return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.jobCategory.toLowerCase().includes(q) ||
        (j.departmentName ?? j.department ?? "").toLowerCase().includes(q) ||
        (j.jobRoleNames ?? []).some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [jobs, activeStatus, searchQuery, categoryFilter]);

  const hasFilters = activeStatus !== "all" || !!searchQuery.trim() || !!categoryFilter;
  /* 検索と職種だけ外す（状態のタブは画面の主軸なので残す） */
  const hasNarrowing = !!searchQuery.trim() || !!categoryFilter;
  function clearNarrowing() {
    setSearchQuery("");
    setCategoryFilter("");
  }

  return (
    <div>
      {/* エラーバナー */}
      {errorMessage && (
        <div role="alert" aria-live="polite" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {errorMessage}
          </span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="エラーを閉じる" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: 16, padding: "0 4px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ★見出し（2026-09-21）。それまでページに見出しが無かった */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>求人管理</h1>
        {isAdmin && (
          <Link href="/biz/jobs/new" className="btn-fixed-size" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 16px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新規求人を作成
          </Link>
        )}
      </div>

      {/* 状態のタブ */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {JOB_STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.status;
            const isRejected = tab.status === "rejected";
            return (
              <button
                type="button"
                key={tab.status}
                onClick={() => setActiveStatus(tab.status)}
                aria-pressed={isActive}
                style={{
                  padding: "7px 13px",
                  background: isActive ? "var(--royal)" : "#fff",
                  border: `1px solid ${isActive ? "var(--royal)" : isRejected && counts.rejected > 0 ? "#FCA5A5" : "var(--line)"}`,
                  borderRadius: 100, fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                  color: isActive ? "#fff" : isRejected && counts.rejected > 0 ? "var(--error)" : "var(--ink-soft)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
                }}
              >
                {tab.labelJa}
                <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 10, fontWeight: 700, opacity: 0.8 }}>
                  {counts[tab.status]}
                </span>
              </button>
            );
          })}
        </div>


      {/* 検索と職種。⚠️ チップは components/common/FilterChip（候補者検索と同じもの） */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0, maxWidth: 420 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-mute)", pointerEvents: "none", display: "flex" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>
            </svg>
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="タイトル・職種・部門で検索"
            aria-label="求人を検索"
            style={{
              width: "100%", height: 36, boxSizing: "border-box",
              padding: "0 32px 0 32px",
              border: "1px solid var(--line)", borderRadius: 999, fontFamily: "inherit",
              fontSize: 13, background: "#fff", outline: "none",
            }}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} aria-label="検索をクリア"
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2, display: "flex", alignItems: "center" }}>×</button>
          )}
        </div>

        {/* ⚠️ 職種が1つも無い会社ではチップごと出さない（押しても選べるものが無い） */}
        {categoryOptions.length > 0 && (
          <FilterChip
            label="職種" value={categoryFilter}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            onSelect={(v) => setCategoryFilter(v ?? "")}
            isOpen={openChip === "category"} onToggle={() => setOpenChip(openChip === "category" ? null : "category")}
          />
        )}

        {hasNarrowing && (
          <button type="button" onClick={clearNarrowing}
            style={{ height: 36, padding: "0 12px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff", fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            条件を外す
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-soft)" }}>
          <strong style={{ fontSize: 15, color: "var(--royal)" }}>{filtered.length}</strong> 件
        </span>
      </div>

      <div>
        {/* 求人リスト */}
        <div>
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
                  {pendingDeleteId === job.id && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 18px", borderRadius: "0 0 10px 10px",
                      background: "#FFF5F5", border: "1px solid #FCA5A5", borderTop: "none", fontSize: 13,
                    }}>
                      <span style={{ color: "var(--error)", fontWeight: 600 }}>この求人を削除しますか？この操作は取り消せません。</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => setPendingDeleteId(null)}
                          style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer" }}>
                          キャンセル
                        </button>
                        <button type="button" onClick={() => confirmDelete(job.id)}
                          style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid var(--error)", background: "var(--error)", color: "#fff", cursor: "pointer" }}>
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
      </div>
    </div>
  );
}
