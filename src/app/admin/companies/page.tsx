"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Toggle } from "@/components/ui/Toggle";
import { updateJobsPublic, updateSortOrder, updateIsPublished, updateApproval } from "./actions";

function getCompanyGradient(str: string): string {
  const gradients = [
    "linear-gradient(135deg, var(--royal), #3B5FD9)",
    "linear-gradient(135deg, #7C3AED, #A855F7)",
    "linear-gradient(135deg, var(--success), #10B981)",
    "linear-gradient(135deg, #F59E0B, #FBBF24)",
    "linear-gradient(135deg, #0EA5E9, #38BDF8)",
    "linear-gradient(135deg, #D97706, #F59E0B)",
    "linear-gradient(135deg, #7C3AED, var(--royal))",
    "linear-gradient(135deg, #DC2626, #F87171)",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

type EngagementStatus = "none" | "verified" | "contracted";
type ListingStatus = "draft" | "listed";

const ENGAGEMENT_CONFIG: Record<EngagementStatus, { label: string; bg: string; color: string; border: string; dot: string }> = {
  none:       { label: "未認証",         bg: "#F1F5F9", color: "#6b7280", border: "#E2E8F0", dot: "#94A3B8" },
  verified:   { label: "ドメイン認証済", bg: "#EFF3FC", color: "var(--royal)", border: "#DCE5F7", dot: "#3B5FD9" },
  contracted: { label: "契約済み",       bg: "#ECFDF5", color: "var(--success)", border: "#A7F3D0", dot: "var(--success)" },
};

const STATUS_TABS = [
  { key: "all",        label: "すべて" },
  { key: "contracted", label: "契約済み" },
  { key: "verified",   label: "ドメイン認証済" },
  { key: "none",       label: "未認証" },
];

type CompanyAdmin = { name: string; isActive: boolean };

type Company = {
  id: string;
  name: string | null;
  brand_name: string | null;
  industry: string | null;
  location: string | null;
  employee_count: string | number | null;
  is_published: boolean;
  is_approved: boolean;
  accepting_casual_meetings: boolean;
  listing_status: ListingStatus | null;
  engagement_status: EngagementStatus | null;
  jobs_public: boolean;
  verified_at: string | null;
  contracted_at: string | null;
  created_at: string;
  updated_at: string;
  sort_order: number | null;
  logo_url: string | null;
  url: string | null;
  job_count?: number;
  admins?: CompanyAdmin[];
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  /* Server Action の失敗をここに出す。握り潰すと「効いたように見えて DB は変わっていない」
     状態になる（2026-08-05 まで全アクションがそうだった） */
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const draggedIdRef = useRef<string | null>(null);

  const loadCompanies = useCallback(async () => {
    const supabase = createClient();

    const [{ data: companyRows }, { data: jobRows }, { data: adminRows }, { data: userRows }] = await Promise.all([
      supabase
        .from("ow_companies")
        .select("id, slug, name, brand_name, industry, location, employee_count, is_published, is_approved, accepting_casual_meetings, listing_status, engagement_status, jobs_public, verified_at, contracted_at, created_at, updated_at, sort_order, logo_url, url")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false }),
      supabase
        .from("ow_jobs")
        .select("company_id"),
      supabase
        .from("ow_company_admins")
        .select("company_id, user_id, is_active"),
      supabase
        .from("ow_users")
        .select("id, name"),
    ]);

    const jobCountMap = new Map<string, number>();
    for (const j of jobRows ?? []) {
      const cid = j.company_id as string;
      jobCountMap.set(cid, (jobCountMap.get(cid) ?? 0) + 1);
    }

    const userNameMap = new Map<string, string>(
      (userRows ?? []).map((u) => [u.id as string, (u.name as string) ?? "不明"])
    );
    const adminMap = new Map<string, CompanyAdmin[]>();
    for (const row of adminRows ?? []) {
      const cid = row.company_id as string;
      if (!adminMap.has(cid)) adminMap.set(cid, []);
      adminMap.get(cid)!.push({
        name: userNameMap.get(row.user_id as string) ?? "不明",
        isActive: row.is_active as boolean,
      });
    }

    const rows: Company[] = (companyRows ?? []).map((c) => ({
      ...(c as Company),
      job_count: jobCountMap.get(c.id as string) ?? 0,
      admins: adminMap.get(c.id as string) ?? [],
    }));

    setCompanies(rows);
    setLoading(false);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  /*
    ⚠️ 楽観更新をしないこと。成功を確認してから state を書き換える。
       2026-08-05 まで結果を見ずに先に画面を更新していたため、
       CHECK 制約で弾かれても「掲載中」と表示され、リロードすると戻る状態だった。
       この画面は useEffect の初回1回しかフェッチしないので、
       revalidatePath でも直らない（サーバー側の再検証は届かない）。
  */
  async function run(companyId: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
                    onSuccess: (c: Company) => Company) {
    setActionLoading(companyId);
    setErrorMsg(null);
    const res = await fn();
    if (res.ok) {
      setCompanies((prev) => prev.map((c) => c.id === companyId ? onSuccess(c) : c));
    } else {
      setErrorMsg(res.error);
    }
    setActionLoading(null);
  }

  // 求人・面談公開（jobs_public）。/jobs/[id] の面談CTAを実際にゲートしている
  function handleJobsPublicToggle(company: Company) {
    const newValue = !company.jobs_public;
    return run(company.id, () => updateJobsPublic(company.id, newValue),
      (c) => ({ ...c, jobs_public: newValue }));
  }

  // 掲載（is_published）。未承認だと CHECK 制約で 23514 になり errorMsg に出る
  function handleIsPublishedToggle(company: Company) {
    const newValue = !company.is_published;
    return run(company.id, () => updateIsPublished(company.id, newValue),
      (c) => ({ ...c, is_published: newValue }));
  }

  // 承認（is_approved）。掲載は別操作なので is_published は動かさない。取り消しは無し
  function handleApprove(company: Company) {
    return run(company.id, () => updateApproval(company.id),
      (c) => ({ ...c, is_approved: true }));
  }

  // ── ドラッグ&ドロップ並び替え（「すべて」タブ + 検索なしのときのみ有効） ──
  const isDndActive = activeTab === "all" && !searchQuery.trim();

  function handleDragStart(e: React.DragEvent, id: string) {
    draggedIdRef.current = id;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIdRef.current !== id) setDragOverId(id);
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = draggedIdRef.current;
    draggedIdRef.current = null;
    if (!sourceId || sourceId === targetId) return;

    const newList = [...companies];
    const fromIdx = newList.findIndex((c) => c.id === sourceId);
    const toIdx   = newList.findIndex((c) => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    // 配列を並び替え
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);

    // sort_order を 0, 1, 2... に再割り当て
    const updated = newList.map((c, i) => ({ ...c, sort_order: i }));
    setCompanies(updated);

    // Supabase に一括保存
    setIsSavingOrder(true);
    const res = await updateSortOrder(updated.map((c) => ({ id: c.id, sort_order: c.sort_order ?? 0 })));
    if (!res.ok) setErrorMsg(res.error);
    setIsSavingOrder(false);
  }

  function handleDragEnd() {
    draggedIdRef.current = null;
    setDragOverId(null);
  }

  const filtered = companies.filter((c) => {
    const es = c.engagement_status ?? "none";
    if (activeTab === "contracted" && es !== "contracted") return false;
    if (activeTab === "verified"   && es !== "verified")   return false;
    if (activeTab === "none"       && es !== "none")       return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.brand_name ?? "").toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const contractedCount = companies.filter((c) => (c.engagement_status ?? "none") === "contracted").length;
  const verifiedCount   = companies.filter((c) => (c.engagement_status ?? "none") === "verified").length;
  const noneCount       = companies.filter((c) => (c.engagement_status ?? "none") === "none").length;

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="skeleton-shimmer" style={{ height: 32, borderRadius: 8, maxWidth: 300, marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3,4,5].map((i) => <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 8 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>企業管理</h1>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--error)", color: "#fff", padding: "2px 7px", borderRadius: 4 }}>ADMIN</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
            企業の承認・掲載と、カジュアル面談CTAの出し分けを管理します
          </p>
        </div>
        {/* KPI バッジ */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "契約済み",         count: contractedCount, bg: "#ECFDF5", color: "var(--success)", border: "#A7F3D0" },
            { label: "ドメイン認証済",   count: verifiedCount,   bg: "#EFF3FC", color: "var(--royal)", border: "#DCE5F7" },
            { label: "未認証",           count: noneCount,       bg: "#F1F5F9", color: "#6b7280", border: "#E2E8F0" },
          ].map(({ label, count, bg, color, border }) => (
            <div key={label} style={{ textAlign: "center", padding: "8px 16px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "Inter, sans-serif", lineHeight: 1.2 }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/*
        ⚠️ 2026-08-05 まで「設計原則: ドメイン認証(verified)で企業情報の編集が可能。
           規約同意(contracted)のみ求人・面談OK公開・成果報酬請求可」と書いていたが、
           どちらも実装されていなかったため削除した。engagement_status は
           何もゲートしていない。実装済みと誤読させる説明を置かないこと。
      */}
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)" }}>掲載の順序:</strong>{" "}
        <strong>承認</strong>（運営が掲載を許可）→ <strong>掲載</strong>（企業ページを公開）。
        承認していない企業は掲載できません（DB制約）。掲載すると求職者向けのフィードに投稿が1件作られます。
        <strong>求人・面談公開</strong>は <code style={{ background: "#EFF3FC", color: "var(--royal)", padding: "1px 5px", borderRadius: 4 }}>/jobs/[id]</code> のカジュアル面談CTAの出し分けです。
      </div>

      {/* Server Action の失敗をここに出す */}
      {errorMsg && (
        <div role="alert" style={{ background: "var(--error-soft)", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12.5, color: "#991B1B", lineHeight: 1.7, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>失敗しました</span>
          <span style={{ flex: 1 }}>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontSize: 14, lineHeight: 1, padding: 2 }}>
            ×
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="企業名・業界・所在地で検索..."
          style={{ width: "100%", padding: "9px 36px 9px 36px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#0F172A", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; }}
          onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all" ? companies.length : tab.key === "contracted" ? contractedCount : tab.key === "verified" ? verifiedCount : noneCount;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={{
              padding: "6px 14px", borderRadius: 100, border: `1px solid ${active ? "var(--royal)" : "#E2E8F0"}`,
              background: active ? "var(--royal)" : "#fff", color: active ? "#fff" : "#475569",
              fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              {tab.label}
              <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 100, background: active ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: active ? "#fff" : "#6b7280" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {isDndActive && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          {isSavingOrder
            ? <><span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--warm)", display: "inline-block", animation: "pulse 1s infinite" }} /> 順序を保存中...</>
            : <><span>⠿</span> 行をドラッグして並び替えできます（「すべて」タブ・検索なし時）</>
          }
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--line)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
                {/*
                  ⚠️ 列を足し引きしたら td 側も colSpan も必ず合わせること。
                  ⚠️「面談CTA」は jobs_public。2026-08-05 まで「求人・面談公開」と
                     書いていたが、この列が制御しているのは /jobs/[id] の
                     カジュアル面談CTAだけで、求人の公開可否（ow_jobs.status）は
                     まったく制御していない。名前が実態と違うと運用を誤る。
                */}
                {["", "企業名", "HP", "ロゴURL", "業界", "担当", "承認", "掲載", "企業ステータス", "面談CTA", "求人数", "ページ", "更新日"].map((h) => (
                  <th key={h} scope="col" style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--ink-mute)", fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-mute)", fontSize: 14 }}>
                  <div style={{ marginBottom: 8, fontSize: 28 }}>🏢</div>企業が見つかりません
                </td></tr>
              ) : (
                filtered.map((c) => {
                  const es = (c.engagement_status ?? "none") as EngagementStatus;

                  const esCfg = ENGAGEMENT_CONFIG[es];
                  const isLoading = actionLoading === c.id;
                  const isDragOver = dragOverId === c.id;
                  return (
                    <tr
                      key={c.id}
                      draggable={isDndActive}
                      onDragStart={isDndActive ? (e) => handleDragStart(e, c.id) : undefined}
                      onDragOver={isDndActive ? (e) => handleDragOver(e, c.id) : undefined}
                      onDragLeave={isDndActive ? handleDragLeave : undefined}
                      onDrop={isDndActive ? (e) => handleDrop(e, c.id) : undefined}
                      onDragEnd={isDndActive ? handleDragEnd : undefined}
                      style={{
                        borderBottom: "1px solid var(--line-soft)",
                        borderTop: isDragOver ? "2px solid var(--royal)" : undefined,
                        opacity: draggedIdRef.current === c.id ? 0.4 : 1,
                        cursor: isDndActive ? "grab" : "default",
                        transition: "border-top 0.1s",
                      }}
                      className="admin-row"
                    >

                      {/* ドラッグハンドル */}
                      <td style={{ padding: "10px 8px", color: "var(--ink-mute)", fontSize: 16, cursor: isDndActive ? "grab" : "default", userSelect: "none" }}>
                        {isDndActive ? "⠿" : ""}
                      </td>

                      {/* 企業名 */}
                      <td style={{ padding: "10px 14px" }}>
                        <Link href={`/admin/companies/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: getCompanyGradient(c.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>
                            {(c.name || "?")[0]}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--royal)" }}>{c.name || "—"}</span>
                            {c.brand_name && (
                              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>{c.brand_name}</div>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* HP（ow_companies.url）— 空欄には何も出さない */}
                      <td style={{ padding: "10px 14px" }}>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noopener noreferrer"
                            title={c.url}
                            style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            HP
                          </a>
                        )}
                      </td>

                      {/* ロゴURL */}
                      <td style={{ padding: "10px 8px", minWidth: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {c.logo_url && (
                            <img src={c.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain", border: "1px solid var(--line)", background: "#fff", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          )}
                          <input
                            type="url"
                            defaultValue={c.logo_url ?? ""}
                            placeholder="https://..."
                            style={{ fontSize: 11, padding: "4px 7px", borderRadius: 6, border: "1px solid var(--line)", width: "100%", minWidth: 120, color: "var(--ink)", outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
                            onBlur={async (e) => {
                              e.currentTarget.style.borderColor = "var(--line)";
                              const val = e.currentTarget.value.trim() || null;
                              if (val === (c.logo_url ?? null)) return;
                              const supabase = createClient();
                              await supabase.from("ow_companies").update({ logo_url: val }).eq("id", c.id);
                              setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, logo_url: val } : x));
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                          />
                        </div>
                      </td>

                      {/* 業界 */}
                      <td style={{ padding: "10px 14px", color: "var(--ink-soft)" }}>{c.industry || <span style={{ color: "var(--ink-mute)" }}>—</span>}</td>

                      {/*
                        担当（BIZ担当者の有無）— 名前は出さず有無だけにした（2026-08-05）。
                        ⚠️ 列は消さないこと。承認は運営・掲載は企業側という運用なので、
                           担当者がいない企業は自分で公開できない。運営から見て
                           「その企業が自走できるか」が分かるのはこの列だけ。
                           名前が要るときは企業名から詳細へ、または BIZ担当者管理を見る。
                      */}
                      <td style={{ padding: "10px 14px" }}>
                        {(() => {
                          const list = c.admins ?? [];
                          const active = list.filter((a) => a.isActive).length;
                          if (list.length === 0) {
                            return <span title="BIZ担当者なし（企業側で公開できない）"
                              style={{ fontSize: 13, color: "var(--ink-mute)" }}>—</span>;
                          }
                          return (
                            <span title={list.map((a) => `${a.name}${a.isActive ? "" : "（無効）"}`).join(" / ")}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                                background: active > 0 ? "var(--royal-50)" : "var(--line-soft)",
                                color: active > 0 ? "var(--royal)" : "var(--ink-mute)",
                                border: `1px solid ${active > 0 ? "var(--royal-100)" : "var(--line)"}`,
                                fontFamily: "Inter, sans-serif",
                              }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              {list.length}
                            </span>
                          );
                        })()}
                      </td>

                      {/*
                        承認 (is_approved) — 運営が掲載を許すかどうか。
                        ⚠️ 2026-08-05 に追加。それまで is_approved を変える UI が
                           アプリ全体に1つも無く（updateApproval は呼び出し元ゼロ）、
                           承認待ちの企業を承認する手段が migration しかなかった。
                        ⚠️ 取り消しは出さない。is_published = true の企業を未承認に戻すと
                           CHECK 制約に違反する行が残る（制約は更新時にしか効かない）。
                        ⚠️ 掲載（is_published）は別操作。承認しても自動では掲載されない。
                      */}
                      <td style={{ padding: "10px 14px" }}>
                        {c.is_approved ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
                                         background: "#ECFDF5", color: "var(--success)", border: "1px solid #A7F3D0", whiteSpace: "nowrap" }}>
                            ✓ 承認済み
                          </span>
                        ) : (
                          <button type="button" onClick={() => handleApprove(c)} disabled={isLoading}
                            title="運営として掲載を承認します。取り消しはできません（掲載は別操作）"
                            style={{
                              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 100, cursor: "pointer",
                              background: "var(--warm)", color: "#fff", border: "none", whiteSpace: "nowrap",
                              opacity: isLoading ? 0.5 : 1,
                            }}>
                            承認する
                          </button>
                        )}
                      </td>

                      {/* 掲載トグル */}
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Toggle
                            checked={c.is_published}
                            onToggle={() => handleIsPublishedToggle(c)}
                            pending={isLoading}
                            label="掲載"
                            onColor="var(--success)"
                          />
                          <span style={{ fontSize: 11, fontWeight: 600, color: c.is_published ? "var(--success)" : "var(--ink-mute)", whiteSpace: "nowrap" }}>
                            {c.is_published ? "掲載中" : "非掲載"}
                          </span>
                        </div>
                      </td>

                      {/*
                        企業ステータス（engagement_status）— 表示のみ。
                        ⚠️ 2026-08-05 に編集を止めた。この値は求職者側・biz側のどこからも
                           参照されておらず、掲載や面談の可否を一切ゲートしていない。
                           それでいて verified / none に変えると jobs_public を false に
                           落とす副作用だけがあり、効かないものが害だけ持っている状態だった。
                           （本番は85社すべて none。verified_at / contracted_at は全社 NULL）
                        ⚠️ カラムは残してある。この概念を実装するなら、まず何をゲートするかを
                           決めてから編集UIを戻すこと。
                      */}
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          title="表示のみ。この値は掲載・面談の可否をゲートしていません"
                          style={{
                            display: "inline-block",
                            fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6,
                            background: esCfg.bg, color: esCfg.color, border: `1px solid ${esCfg.border}`,
                          }}
                        >
                          {esCfg.label}
                        </span>
                        {es === "verified" && c.verified_at && (
                          <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 3, fontFamily: "Inter, sans-serif" }}>
                            認証: {new Date(c.verified_at).toLocaleDateString("ja-JP")}
                          </div>
                        )}
                        {es === "contracted" && c.contracted_at && (
                          <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 3, fontFamily: "Inter, sans-serif" }}>
                            契約: {new Date(c.contracted_at).toLocaleDateString("ja-JP")}
                          </div>
                        )}
                      </td>

                      {/*
                        求人・面談公開 (jobs_public) — /jobs/[id] のカジュアル面談CTAを実際にゲートする。
                        ⚠️ 2026-08-05 まで engagement_status = contracted のときしかトグルを出さず、
                           本番は全85社が none だったため「🔒 要認証」しか出ていなかった。
                           一方 DB では77社が true で CTA は本番で出ていた。
                           ゲートしていないものをゲートしているように見せていたので鍵表示は削除した。
                      */}
                      <td style={{ padding: "10px 14px" }}>
                        <Toggle
                          checked={c.jobs_public}
                          onToggle={() => handleJobsPublicToggle(c)}
                          pending={isLoading}
                          label="面談CTA"
                        />
                      </td>

                      {/* 求人数 */}
                      <td style={{ padding: "10px 14px" }}>
                        {(c.job_count ?? 0) > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>
                            {c.job_count}件
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* 企業ページへのリンク */}
                      <td style={{ padding: "10px 14px" }}>
                        <Link href={`/companies/${(c as any).slug ?? c.id}`} target="_blank"
                          style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          表示
                        </Link>
                      </td>

                      {/* 更新日 */}
                      <td style={{ padding: "10px 14px", color: "var(--ink-mute)", fontSize: 11, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>
                        {new Date(c.updated_at).toLocaleDateString("ja-JP")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .admin-row:hover { background: var(--bg-tint); }
        .admin-row:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
}
