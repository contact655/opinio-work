"use client";

import { shortLocation } from "@/lib/jobs/shortLocation";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BizJob } from "@/lib/business/mockJobs";
import { countByTab } from "@/lib/business/mockJobs";
import { JOB_STATE_LABEL, JOB_TABS, JOB_TAB_LABEL, jobState, jobStateTab, type JobStateTab } from "@/lib/jobs/jobState";
import { JobsEmptyState } from "@/components/business/JobsEmptyState";
import { FilterChip } from "@/components/common/FilterChip";

type Props = {
  jobs: BizJob[];
  isAdmin?: boolean;
  /** `?status=` 由来の初期タブ。⚠️ 検証済みの値だけが来る（page.tsx を参照） */
  initialStatus?: JobStateTab | "all";
  /** `?dept=` 由来の部門（部門 id）。⚠️ 選択肢に無ければ無視する */
  initialDept?: string;
  /** 閲覧数が取れなかった（「—」と出す。0 と出さない） */
  viewsFailed?: boolean;
  /** ★その会社の部門（部門・職種の設定にあるもの。2026-10-12）。取れなければ null（求人にある部門だけで選択肢を作る） */
  departments?: { id: string; name: string }[] | null;
  /** ★社内メモの冒頭（2行まで）。求人 id → 冒頭。メモが無い求人は入らない（2026-10-12） */
  internalNotes?: Record<string, string>;
};

/* ★2026-09-21 に左の絞り込み欄（部門・職種・雇用形態・年収）をやめた（柴さん）。
      自社の求人は数件で、常時開きの欄は大きすぎた。残したのは状態のタブ・検索・職種の3つ。
   ⚠️ 部門はフリーワード検索に含めてある（部門名でも当たる）。
   ⚠️ 年収の絞り込みは**万円の値を円（×10000）と比べていて一度も正しく効いていなかった**。
      戻すなら単位を揃えること（`salaryMin` / `salaryMax` は万円）。 */

/**
 * ★求人管理の一覧（2026-10-12 / 柴さんの指示。大きなカードをやめ、1行1求人にした）。
 *   列: タイトル（下に灰色で 部門 › 職種・雇用形態・勤務地）／状態（灰色の文字）／応募／面談／閲覧（直近30日）／更新日／⋯
 *   ⚠️ 色付きのバッジを使わない（状態も雇用形態も職種も灰色の文字）
 *   ★状態は 下書き／公開中／停止中 の3つ（2026-10-12。lib/jobs/jobState.ts）。タブは すべて／公開中／下書き／停止中
 *     停止中は2種類: 自社で停止（⋯「再開する」）／運営が停止（下に理由。⋯「再開を依頼する」→ 再開を依頼済み）
 *   ⚠️ 下書きで公開できないもの（項目の不足・禁止表現）は、状態の位置に「公開まであと〇つ」
 *   ⚠️ 応募・面談の数を押すと、選考管理（/biz/meetings?job=<id>）をその求人で絞って開く
 *   ★部門で絞り込める（?dept=。求人がある部門だけを選択肢にする）
 */
function statusText(j: BizJob): string {
  const v = jobState(j);
  /* ⚠️「〜つ」は9まで。10以上は「〜項目」 */
  const n = j.publishMissingCount ?? 0;
  if (v === "draft" && n > 0) return n < 10 ? `公開まであと${n}つ` : `公開まであと${n}項目`;
  return JOB_STATE_LABEL[v];
}
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const v = (t: string) => ps.find((p) => p.type === t)?.value ?? "";
  const thisYear = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date()).replace(/\D/g, "");
  return `${v("year") === thisYear ? "" : `${v("year")}/`}${v("month")}/${v("day")}`;
}
/** 2行目「営業部 › PDM ・ 正社員 ・ 東京都」。⚠️ 部門が無ければ「PDM ・ 正社員 ・ 東京都」。「職種：」とは書かない */
function subLine(j: BizJob): string {
  const role = j.companyRoleName || (j.jobRoleNames ?? [])[0] || j.jobCategory;
  const dept = j.departmentName || j.department || "";
  const head = dept && role ? `${dept} › ${role}` : dept || role || "";
  /* ★勤務地は都道府県＋市区町村まで（2026-10-12）。番地・建物名は出さない。詳細・編集画面は元の値のまま */
  return [head || null, j.employmentType || null, shortLocation(j.location)].filter(Boolean).join(" ・ ");
}

/** 「部門なし」の値（?dept=none）。⚠️ 部門の id（uuid）と重ならない文字列 */
const NO_DEPT = "none";

export function JobsClient({ jobs: initialJobs, isAdmin = true, initialStatus = "all", initialDept = "", viewsFailed = false, departments = null, internalNotes = {} }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<BizJob[]>(initialJobs);
  const [activeStatus, setActiveStatus] = useState<JobStateTab | "all">(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const showError = (msg: string, ms = 4000) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), ms);
  };

  /* ★「停止する」（公開中 → 自社で停止）。⚠️ 停止の記録（stopped_*）は付けない（運営の停止と区別するため） */
  const stopJob = useCallback(async (jobId: string) => {
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
      showError("停止できませんでした。再度お試しください。");
    }
  }, [jobs]);

  /* ★「再開する」（自社で停止 → 公開判定を通れば即時公開）／「再開を依頼する」（運営が停止 → 運営の確認待ち）。
        どちらも同じ「公開する」の申し出（PATCH published）で、何になるかはサーバーの requestPublish が決める。
     ⚠️ 結果を見てから画面を変える（楽観的に変えない。公開できない理由はサーバーの文をそのまま出す） */
  const resumeJob = useCallback(async (jobId: string) => {
    setMenuId(null);
    const res = await fetch(`/api/biz/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", value: "published" }),
    });
    const d = (await res.json().catch(() => null)) as { error?: string; decision?: string } | null;
    if (!res.ok) { showError(d?.error ?? "再開できませんでした。再度お試しください。", 8000); return; }
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: d?.decision === "review" ? "pending_review" : "published" } : j));
  }, []);

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

  const counts = useMemo(() => countByTab(jobs), [jobs]);

  /* ★部門の選択肢（2026-10-12 に変えた / 柴さんの指示）。**その会社の部門すべて＋「部門なし」**、件数を横に。
        それまでは「部門付きの求人がある部門だけ」で、部門付きの求人が0件だと絞り込みごと消えていた。
        ⚠️ 件数はいま選んでいる状態のタブの中で数える（押したときに出る件数と揃える）。
        ⚠️ 部門の一覧が取れなかったとき（null）は、求人に付いている部門だけで作る（消さない） */
  const deptOptions = useMemo(() => {
    const inTab = jobs.filter((j) => activeStatus === "all" || jobStateTab(jobState(j)) === activeStatus);
    const count = new Map<string, number>();
    let none = 0;
    for (const j of inTab) { if (j.departmentId) count.set(j.departmentId, (count.get(j.departmentId) ?? 0) + 1); else none++; }
    const names = new Map<string, string>((departments ?? []).map((d) => [d.id, d.name]));
    for (const j of jobs) if (j.departmentId && j.departmentName && !names.has(j.departmentId)) names.set(j.departmentId, j.departmentName);
    const opts = Array.from(names, ([value, name]) => ({ value, label: `${name}（${count.get(value) ?? 0}）`, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"))
      .map(({ value, label }) => ({ value, label }));
    return [...opts, { value: NO_DEPT, label: `部門なし（${none}）` }];
  }, [jobs, departments, activeStatus]);
  /** 会社に部門が1つも無い（部門・職種の設定が空）。⚠️ 取れなかった（null）は「無い」と言わない */
  const noDepartments = departments !== null && departments.length === 0 && !jobs.some((j) => j.departmentId);
  /* ⚠️ URL の値は選択肢に無ければ無視する（消えた部門・他社の id） */
  const [deptFilter, setDeptFilter] = useState(initialDept);
  const activeDept = deptOptions.some((d) => d.value === deptFilter) ? deptFilter : "";

  /* ★選択を URL に残す（?status= / ?dept=）。⚠️ router.replace にしない（サーバーで一覧を引き直すことになる） */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (activeStatus === "all") p.delete("status"); else p.set("status", activeStatus);
    if (activeDept) p.set("dept", activeDept); else p.delete("dept");
    const q = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, [activeStatus, activeDept]);

  /* ★職種の選択肢は、部門を選んでいればその部門の求人の職種だけ（2026-10-12 / 柴さんの指示）。未選択なら全部 */
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    const inDept = jobs.filter((j) => !activeDept || (activeDept === NO_DEPT ? !j.departmentId : j.departmentId === activeDept));
    inDept.forEach((j) => {
      (j.jobRoleNames ?? []).forEach((n) => set.add(n));
      if (j.jobCategory) set.add(j.jobCategory);
    });
    return Array.from(set).sort();
  }, [jobs, activeDept]);
  /* ⚠️ 部門を変えて、選択中の職種がその部門に無ければ職種の選択を外す */
  useEffect(() => {
    if (categoryFilter && !categoryOptions.includes(categoryFilter)) setCategoryFilter("");
  }, [categoryFilter, categoryOptions]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (activeStatus !== "all" && jobStateTab(jobState(j)) !== activeStatus) return false;
      if (activeDept === NO_DEPT ? !!j.departmentId : (activeDept && j.departmentId !== activeDept)) return false;
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
  }, [jobs, activeStatus, searchQuery, categoryFilter, activeDept]);

  const hasFilters = activeStatus !== "all" || !!searchQuery.trim() || !!categoryFilter || !!activeDept;
  const hasNarrowing = !!searchQuery.trim() || !!categoryFilter || !!activeDept;

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

      {/* 状態のタブ（下線だけ）。すべて／公開中／下書き／停止中（2026-10-12） */}
      <div role="tablist" aria-label="求人の状態" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 12, overflowX: "auto" }}>
        {JOB_TABS.map((st) => {
          const active = activeStatus === st;
          return (
            <button key={st} type="button" role="tab" aria-selected={active} data-tab={st} className="btn-fixed-size"
              onClick={() => setActiveStatus(st)}
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 12px", border: 0, borderBottom: `3px solid ${active ? "var(--royal)" : "transparent"}`, background: "none", fontFamily: "inherit", fontSize: 14, fontWeight: active ? 700 : 500, color: active ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer" }}>
              {JOB_TAB_LABEL[st]}
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
        {/* ★求人が1件以上あれば常に出す（2026-10-12）。部門が1つも無い会社は登録への入口だけ */}
        {jobs.length > 0 && (noDepartments ? (
          <a href="/biz/organization" data-state="dept-register-link" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none", whiteSpace: "nowrap" }}>部門・職種を登録する ›</a>
        ) : (
          <FilterChip
            label="部門" value={activeDept}
            options={deptOptions}
            onSelect={(v) => setDeptFilter(v ?? "")}
            isOpen={openChip === "dept"} onToggle={() => setOpenChip(openChip === "dept" ? null : "dept")}
          />
        ))}
        {/* ★部門 → 職種 の順（2026-10-12）。職種の選択肢は選んだ部門に絞る */}
        {categoryOptions.length > 0 && (
          <FilterChip
            label="職種" value={categoryFilter}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            onSelect={(v) => setCategoryFilter(v ?? "")}
            isOpen={openChip === "category"} onToggle={() => setOpenChip(openChip === "category" ? null : "category")}
          />
        )}
        {hasNarrowing && (
          <button type="button" onClick={() => { setSearchQuery(""); setCategoryFilter(""); setDeptFilter(""); }}
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
              const v = jobState(j);
              /* ★運営が停止した求人は、下に理由を出す（再開を依頼済みでも） */
              const note = v === "stopped_ops" || v === "reopen_requested" ? (j.stoppedReason ?? j.rejectionReason ?? null) : null;
              return (
                <div key={j.id}>
                  <div className="jl-row" data-item="job" data-status={v}>
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/biz/jobs/${j.id}/edit`} style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "none", overflowWrap: "anywhere" }}>{j.title}</Link>
                      {/* ★社内メモの印（2026-10-12）。乗せると冒頭2行（title 属性）。⚠️ 求職者には出さない */}
                      {internalNotes[j.id] && (
                        <span title={`社内メモ：\n${internalNotes[j.id]}`} aria-label="社内メモあり" data-state="job-note-mark"
                          style={{ display: "inline-flex", verticalAlign: "-2px", marginLeft: 6, color: "var(--ink-mute)", cursor: "help" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
                          </svg>
                        </span>
                      )}
                      <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={subLine(j)}>{subLine(j)}</div>
                      {note && (
                        <div data-state="job-stop-reason" style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, overflowWrap: "anywhere" }}>
                          停止の理由：{note}
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
                          <Link role="menuitem" href={`/biz/jobs/${j.id}/edit${v === "draft" ? "?section=review" : ""}`}>{v === "draft" ? "編集・公開" : "編集"}</Link>
                          <Link role="menuitem" href={`/biz/jobs/${j.id}/preview`}>プレビュー</Link>
                          {isAdmin && <button type="button" role="menuitem" onClick={() => handleDuplicate(j.id)}>複製</button>}
                          {isAdmin && v === "published" && <button type="button" role="menuitem" onClick={() => stopJob(j.id)}>停止する</button>}
                          {isAdmin && v === "stopped_self" && <button type="button" role="menuitem" onClick={() => resumeJob(j.id)}>再開する</button>}
                          {isAdmin && v === "stopped_ops" && <button type="button" role="menuitem" onClick={() => resumeJob(j.id)}>再開を依頼する</button>}
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
