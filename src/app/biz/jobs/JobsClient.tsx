"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BizJob, JobStatus } from "@/lib/business/mockJobs";
import { JOB_STATUS_TABS, countByStatus, jobViewStatus } from "@/lib/business/mockJobs";
import { JobsEmptyState } from "@/components/business/JobsEmptyState";
import { FilterChip } from "@/components/common/FilterChip";

type Props = {
  jobs: BizJob[];
  isAdmin?: boolean;
  /** `?status=` 由来の初期タブ。⚠️ 検証済みの値だけが来る（page.tsx を参照） */
  initialStatus?: JobStatus | "all";
  /** 閲覧数が取れなかった（「—」と出す。0 と出さない） */
  viewsFailed?: boolean;
};

/* ★2026-09-21 に左の絞り込み欄（部門・職種・雇用形態・年収）をやめた（柴さん）。
      自社の求人は数件で、常時開きの欄は大きすぎた。残したのは状態のタブ・検索・職種の3つ。
   ⚠️ 部門はフリーワード検索に含めてある（部門名でも当たる）。
   ⚠️ 年収の絞り込みは**万円の値を円（×10000）と比べていて一度も正しく効いていなかった**。
      戻すなら単位を揃えること（`salaryMin` / `salaryMax` は万円）。 */

/**
 * ★求人管理の一覧（2026-10-12 / 柴さんの指示。大きなカードをやめ、1行1求人にした）。
 *   列: タイトル（下に灰色で 職種・雇用形態・勤務地）／状態（灰色の文字）／応募／面談／閲覧（直近30日）／更新日／⋯
 *   ⚠️ 色付きのバッジを使わない（状態も雇用形態も職種も灰色の文字）
 *   ⚠️ タブは すべて／公開中／下書き／非公開。運営確認中・停止中は1件以上あるときだけ出す
 *   ⚠️ 下書きで項目が足りないものは、状態の位置に「公開まであと〇つ」
 *   ⚠️ 応募・面談の数を押すと、選考管理（/biz/meetings?job=<id>）をその求人で絞って開く
 */
const MAIN_TABS: (JobStatus | "all")[] = ["all", "published", "draft", "private"];
const COND_TABS: JobStatus[] = ["pending_review", "rejected"];
const tabLabel = (st: JobStatus | "all") => JOB_STATUS_TABS.find((t) => t.status === st)?.labelJa ?? st;

function statusText(j: BizJob): string {
  const v = jobViewStatus(j);
  /* ⚠️「〜つ」は9まで。10以上は「〜項目」 */
  const n = j.publishMissingCount ?? 0;
  if (v === "draft" && n > 0) return n < 10 ? `公開まであと${n}つ` : `公開まであと${n}項目`;
  return tabLabel(v);
}
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const v = (t: string) => ps.find((p) => p.type === t)?.value ?? "";
  const thisYear = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date()).replace(/\D/g, "");
  return `${v("year") === thisYear ? "" : `${v("year")}/`}${v("month")}/${v("day")}`;
}
function subLine(j: BizJob): string {
  const role = j.companyRoleName || (j.jobRoleNames ?? [])[0] || j.jobCategory;
  return [role ? `職種：${role}` : null, j.employmentType || null, j.location || null].filter(Boolean).join("・");
}

export function JobsClient({ jobs: initialJobs, isAdmin = true, initialStatus = "all", viewsFailed = false }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<BizJob[]>(initialJobs);
  const [activeStatus, setActiveStatus] = useState<JobStatus | "all">(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  /* ⚠️ 一覧から変えられる状態は「非公開にする」だけ（公開は編集画面の「確認して公開」から。ガイドラインへの同意の一文を通す） */
  const makePrivate = useCallback(async (jobId: string) => {
    setMenuId(null);
    const old = jobs.find((j) => j.id === jobId);
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "private" } : j));
    const res = await fetch(`/api/biz/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", value: "private" }),
    });
    if (!res.ok && old) {
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: old.status } : j));
      showError("非公開にできませんでした。再度お試しください。");
    }
  }, [jobs]);

  const confirmDelete = useCallback(async (jobId: string) => {
    setPendingDeleteId(null);
    const snapshot = jobs;
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    const res = await fetch(`/api/biz/jobs/${jobId}`, { method: "DELETE" });
    if (!res.ok) {
      setJobs(snapshot);
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      showError(j?.error ?? "削除に失敗しました。再度お試しください。");
    }
  }, [jobs]);

  const handleDuplicate = useCallback(async (jobId: string) => {
    setMenuId(null);
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
  const tabs: (JobStatus | "all")[] = [...MAIN_TABS, ...COND_TABS.filter((t) => counts[t] > 0 || activeStatus === t)];

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
      if (activeStatus !== "all" && jobViewStatus(j) !== activeStatus) return false;
      if (categoryFilter) {
        const roles = j.jobRoleNames ?? [];
        if (!roles.includes(categoryFilter) && j.jobCategory !== categoryFilter) return false;
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
  const hasNarrowing = !!searchQuery.trim() || !!categoryFilter;

  const countCell = (n: number, j: BizJob, kind: "applications" | "meetings") => n > 0 ? (
    <Link href={`/biz/meetings?job=${j.id}${kind === "applications" ? "&tab=applications" : "&tab=meetings"}`} data-state={`count-${kind}`} style={{ color: "var(--royal)", fontWeight: 700, textDecoration: "none" }}>{n}</Link>
  ) : <span style={{ color: "var(--ink-mute)" }}>0</span>;

  return (
    <div onClick={() => menuId && setMenuId(null)}>
      <style>{`
        .jl-head, .jl-row { display: grid; grid-template-columns: minmax(0, 1fr) 150px 56px 56px 72px 72px 40px; gap: 12px; align-items: center; padding: 12px 16px; }
        .jl-head { font-size: 12px; color: var(--ink-mute); border-bottom: 1px solid var(--line); }
        .jl-row { border-top: 1px solid var(--line-soft); font-size: 13px; color: var(--ink); background: #fff; }
        .jl-row:first-child { border-top: 0; }
        .jl-num { text-align: right; font-variant-numeric: tabular-nums; }
        .jl-mlabel { display: none; }
        .jl-menu { position: absolute; right: 0; top: 30px; z-index: 20; min-width: 160px; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,0.12); padding: 4px; }
        .jl-menu button, .jl-menu a { display: block; width: 100%; text-align: left; padding: 8px 12px; border: 0; background: none; font: inherit; font-size: 13px; color: var(--ink); text-decoration: none; border-radius: 6px; cursor: pointer; }
        .jl-menu button:hover, .jl-menu a:hover { background: var(--bg-tint); }
        @media (max-width: 899px) {
          .jl-head { display: none; }
          .jl-row { grid-template-columns: minmax(0, 1fr) 40px; row-gap: 6px; }
          .jl-cell-status, .jl-num { grid-column: 1; text-align: left; }
          .jl-cell-menu { grid-column: 2; grid-row: 1; }
          .jl-nums { grid-column: 1; display: flex; gap: 14px; font-size: 12.5px; color: var(--ink-soft); }
          .jl-mlabel { display: inline; color: var(--ink-mute); margin-right: 4px; }
        }
        @media (min-width: 900px) { .jl-nums { display: contents; } }
      `}</style>

      {errorMessage && (
        <div role="alert" aria-live="polite" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
        }}>
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="エラーを閉じる" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: 16, padding: "0 4px" }}>×</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>求人管理</h1>
        {isAdmin && (
          <Link href="/biz/jobs/new" className="btn-fixed-size" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 16px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            ＋ 新規求人を作成
          </Link>
        )}
      </div>

      {/* 状態のタブ（下線だけ）。⚠️ 運営確認中・停止中は1件以上のときだけ */}
      <div role="tablist" aria-label="求人の状態" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 12, overflowX: "auto" }}>
        {tabs.map((st) => {
          const active = activeStatus === st;
          return (
            <button key={st} type="button" role="tab" aria-selected={active} data-tab={st} className="btn-fixed-size"
              onClick={() => setActiveStatus(st)}
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 12px", border: 0, borderBottom: `3px solid ${active ? "var(--royal)" : "transparent"}`, background: "none", fontFamily: "inherit", fontSize: 14, fontWeight: active ? 700 : 500, color: active ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer" }}>
              {tabLabel(st)}
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>{counts[st]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0, maxWidth: 420 }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="タイトル・職種・部門で検索"
            aria-label="求人を検索"
            style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 14px", border: "1px solid var(--line)", borderRadius: 999, fontFamily: "inherit", fontSize: 13, background: "#fff", outline: "none" }}
          />
        </div>
        {categoryOptions.length > 0 && (
          <FilterChip
            label="職種" value={categoryFilter}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            onSelect={(v) => setCategoryFilter(v ?? "")}
            isOpen={openChip === "category"} onToggle={() => setOpenChip(openChip === "category" ? null : "category")}
          />
        )}
        {hasNarrowing && (
          <button type="button" onClick={() => { setSearchQuery(""); setCategoryFilter(""); }}
            style={{ height: 36, padding: "0 12px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff", fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            条件を外す
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-soft)" }}>{filtered.length} 件</span>
      </div>

      {filtered.length === 0 ? (
        <JobsEmptyState hasFilters={hasFilters} />
      ) : (
        <section data-state="job-list" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12 }}>
          <div className="jl-head" aria-hidden="true">
            <span>求人</span><span>状態</span><span className="jl-num">応募</span><span className="jl-num">面談</span>
            <span className="jl-num" title="直近30日">閲覧</span><span className="jl-num">更新日</span><span />
          </div>
          <div>
            {filtered.map((j) => {
              const v = jobViewStatus(j);
              const note = v === "rejected" ? (j.stoppedReason ?? j.rejectionReason ?? null)
                : v === "pending_review" && (j.wordingHits?.length ?? 0) > 0 ? `運営が確認している表現：${j.wordingHits!.join("・")}` : null;
              return (
                <div key={j.id}>
                  <div className="jl-row" data-item="job" data-status={v}>
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/biz/jobs/${j.id}/edit`} style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "none", overflowWrap: "anywhere" }}>{j.title}</Link>
                      <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={subLine(j)}>{subLine(j)}</div>
                      {note && (
                        <div data-state={v === "rejected" ? "job-stop-reason" : "job-review-hits"} style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, overflowWrap: "anywhere" }}>
                          {v === "rejected" ? `停止の理由：${note}` : note}
                        </div>
                      )}
                    </div>
                    <div className="jl-cell-status" data-state="job-status-text" style={{ color: "var(--ink-mute)", fontSize: 13 }}>{statusText(j)}</div>
                    <div className="jl-nums">
                      <span className="jl-num"><span className="jl-mlabel">応募</span>{countCell(j.applicationCount, j, "applications")}</span>
                      <span className="jl-num"><span className="jl-mlabel">面談</span>{countCell(j.meetingCount, j, "meetings")}</span>
                      <span className="jl-num" style={{ color: "var(--ink-soft)" }}><span className="jl-mlabel">閲覧</span>{viewsFailed || j.views30d === undefined ? "—" : j.views30d}</span>
                      <span className="jl-num" style={{ color: "var(--ink-soft)" }}><span className="jl-mlabel">更新</span>{fmtDate(j.updatedAtIso)}</span>
                    </div>
                    <div className="jl-cell-menu" style={{ position: "relative", textAlign: "right" }}>
                      <button type="button" aria-label={`「${j.title}」の操作`} aria-expanded={menuId === j.id} data-state="job-menu-button" className="btn-fixed-size"
                        onClick={(e) => { e.stopPropagation(); setMenuId(menuId === j.id ? null : j.id); }}
                        style={{ width: 32, height: 32, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", color: "var(--ink-soft)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>⋯</button>
                      {menuId === j.id && (
                        <div className="jl-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                          <Link role="menuitem" href={`/biz/jobs/${j.id}/edit${v === "draft" || v === "private" || v === "rejected" || v === "pending_review" ? "?section=review" : ""}`}>{v === "published" ? "編集" : "編集・公開"}</Link>
                          <Link role="menuitem" href={`/biz/jobs/${j.id}/preview`}>プレビュー</Link>
                          {isAdmin && <button type="button" role="menuitem" onClick={() => handleDuplicate(j.id)}>複製</button>}
                          {isAdmin && v === "published" && <button type="button" role="menuitem" onClick={() => makePrivate(j.id)}>非公開にする</button>}
                          {isAdmin && v !== "published" && <button type="button" role="menuitem" style={{ color: "var(--error)" }} onClick={() => { setMenuId(null); setPendingDeleteId(j.id); }}>削除</button>}
                        </div>
                      )}
                    </div>
                  </div>
                  {pendingDeleteId === j.id && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 16px", background: "#FFF5F5", borderTop: "1px solid #FCA5A5", fontSize: 13 }}>
                      <span style={{ color: "var(--error)", fontWeight: 600 }}>この求人を削除しますか？この操作は取り消せません。</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => setPendingDeleteId(null)}
                          style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer" }}>キャンセル</button>
                        <button type="button" onClick={() => confirmDelete(j.id)}
                          style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid var(--error)", background: "var(--error)", color: "#fff", cursor: "pointer" }}>削除する</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
