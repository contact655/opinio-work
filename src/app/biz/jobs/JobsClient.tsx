"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BizJob, JobStatus } from "@/lib/business/mockJobs";
import { JOB_STATUS_TABS, countByStatus } from "@/lib/business/mockJobs";
import { JobListCard } from "@/components/business/JobListCard";
import { JobsEmptyState } from "@/components/business/JobsEmptyState";

type Props = {
  jobs: BizJob[];
  isAdmin?: boolean;
  /** `?status=` 由来の初期タブ。⚠️ 検証済みの値だけが来る（page.tsx を参照） */
  initialStatus?: JobStatus | "all";
};

const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

const SALARY_OPTIONS = [
  { label: "指定なし", min: 0, max: 0 },
  { label: "〜500万円", min: 0, max: 500 },
  { label: "500〜800万円", min: 500, max: 800 },
  { label: "800〜1000万円", min: 800, max: 1000 },
  { label: "1000〜1500万円", min: 1000, max: 1500 },
  { label: "1500万円〜", min: 1500, max: 0 },
];

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string;
}) {
  const active = !!value;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", height: 34, padding: "0 28px 0 10px",
        border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
        borderRadius: 8, fontFamily: "inherit", fontSize: 12,
        color: active ? "var(--royal)" : "var(--ink-soft)",
        fontWeight: active ? 700 : 400,
        background: active ? "var(--royal-50)" : "#fff",
        outline: "none", cursor: "pointer",
        appearance: "none" as const,
        backgroundImage: CHEVRON_SVG,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function JobsClient({ jobs: initialJobs, isAdmin = true, initialStatus = "all" }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<BizJob[]>(initialJobs);
  const [activeStatus, setActiveStatus] = useState<JobStatus | "all">(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const [salaryRange, setSalaryRange] = useState(0); // index into SALARY_OPTIONS
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

  const deptOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.departmentName) set.add(j.departmentName);
      else if (j.department) set.add(j.department);
    });
    return Array.from(set).sort();
  }, [jobs]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      (j.jobRoleNames ?? []).forEach((n) => set.add(n));
      if (j.jobCategory) set.add(j.jobCategory);
    });
    return Array.from(set).sort();
  }, [jobs]);

  const empTypeOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => { if (j.employmentType) set.add(j.employmentType); });
    return Array.from(set).sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    const sal = SALARY_OPTIONS[salaryRange];
    return jobs.filter((j) => {
      if (activeStatus !== "all" && j.status !== activeStatus) return false;
      if (deptFilter) {
        const dept = j.departmentName ?? j.department ?? "";
        if (dept !== deptFilter) return false;
      }
      if (categoryFilter) {
        const roles = j.jobRoleNames ?? [];
        const matchesRole = roles.includes(categoryFilter);
        const matchesCategory = j.jobCategory === categoryFilter;
        if (!matchesRole && !matchesCategory) return false;
      }
      if (empTypeFilter && j.employmentType !== empTypeFilter) return false;
      if (sal.min > 0 && (j.salaryMax ?? 0) < sal.min * 10000) return false;
      if (sal.max > 0 && (j.salaryMin ?? 0) > sal.max * 10000) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.jobCategory.toLowerCase().includes(q) ||
        (j.departmentName ?? j.department ?? "").toLowerCase().includes(q) ||
        (j.jobRoleNames ?? []).some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [jobs, activeStatus, searchQuery, deptFilter, categoryFilter, empTypeFilter, salaryRange]);

  const hasFilters = activeStatus !== "all" || !!searchQuery.trim() || !!deptFilter || !!categoryFilter || !!empTypeFilter || salaryRange > 0;

  function clearAll() {
    setActiveStatus("all");
    setSearchQuery("");
    setDeptFilter("");
    setCategoryFilter("");
    setEmpTypeFilter("");
    setSalaryRange(0);
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

      {/* 上部バー: ステータスタブ + 検索 + ボタン */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* ステータスタブ */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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

        <div style={{ flex: 1 }} />

        {/* 検索ボックス */}
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ink-mute)", pointerEvents: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>
            </svg>
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="求人タイトルで検索..."
            aria-label="求人を検索"
            style={{
              padding: searchQuery ? "7px 32px 7px 32px" : "7px 12px 7px 32px",
              border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit",
              fontSize: 12, background: "#fff", width: 220, outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} aria-label="検索をクリア"
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2, display: "flex", alignItems: "center" }}>×</button>
          )}
        </div>

        {/* 新規求人作成ボタン */}
        {isAdmin && (
          <Link href="/biz/jobs/new" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新規求人を作成
          </Link>
        )}
      </div>

      {/* サイドバー + メインコンテンツ */}
      <div className="biz-2col" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>

        {/* 左サイドバー */}
        <aside style={{
          background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
          padding: "16px 0", position: "sticky", top: 16,
        }}>
          <div style={{ padding: "0 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>絞り込み</span>
            {hasFilters && (
              <button type="button" onClick={clearAll}
                style={{ fontSize: 11, color: "var(--royal)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                リセット
              </button>
            )}
          </div>

          <div style={{ padding: "0 14px" }}>
            {/* 部門 */}
            <SidebarSection title="部門">
              <FilterSelect value={deptFilter} onChange={setDeptFilter} options={deptOptions} placeholder="すべての部門" />
            </SidebarSection>

            {/* 職種 */}
            <SidebarSection title="職種">
              <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} placeholder="すべての職種" />
            </SidebarSection>

            {/* 雇用形態 */}
            <SidebarSection title="雇用形態">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {empTypeOptions.map((t) => (
                  <label key={t} onClick={(e) => { e.preventDefault(); setEmpTypeFilter(empTypeFilter === t ? "" : t); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", userSelect: "none" }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${empTypeFilter === t ? "var(--royal)" : "#CBD5E1"}`,
                      background: empTypeFilter === t ? "var(--royal)" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s",
                    }}>
                      {empTypeFilter === t && (
                        <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l2.5 3L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span style={{ fontSize: 12, color: empTypeFilter === t ? "var(--ink)" : "var(--ink-soft)", fontWeight: empTypeFilter === t ? 600 : 400 }}>{t}</span>
                  </label>
                ))}
              </div>
            </SidebarSection>

            {/* 年収 */}
            <div style={{ paddingBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>年収</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {SALARY_OPTIONS.map((o, i) => (
                  <label key={i} onClick={(e) => { e.preventDefault(); setSalaryRange(salaryRange === i ? 0 : i); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", userSelect: "none" }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${salaryRange === i ? "var(--royal)" : "#CBD5E1"}`,
                      background: salaryRange === i ? "var(--royal)" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s",
                    }}>
                      {salaryRange === i && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "block" }} />}
                    </span>
                    <span style={{ fontSize: 12, color: salaryRange === i ? "var(--ink)" : "var(--ink-soft)", fontWeight: salaryRange === i ? 600 : 400 }}>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 求人リスト */}
        <main>
          {hasFilters && filtered.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 8, textAlign: "right" }}>
              {filtered.length} 件
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
        </main>
      </div>
    </div>
  );
}
