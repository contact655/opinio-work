"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function getCompanyGradient(str: string): string {
  const gradients = [
    "linear-gradient(135deg, #002366, #3B5FD9)",
    "linear-gradient(135deg, #7C3AED, #A855F7)",
    "linear-gradient(135deg, #059669, #10B981)",
    "linear-gradient(135deg, #F59E0B, #FBBF24)",
    "linear-gradient(135deg, #0EA5E9, #38BDF8)",
    "linear-gradient(135deg, #D97706, #F59E0B)",
    "linear-gradient(135deg, #7C3AED, #002366)",
    "linear-gradient(135deg, #DC2626, #F87171)",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

type EngagementStatus = "none" | "verified" | "contracted";
type ListingStatus = "draft" | "listed";

const ENGAGEMENT_CONFIG: Record<EngagementStatus, { label: string; bg: string; color: string; border: string; dot: string }> = {
  none:       { label: "未認証",         bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0", dot: "#94A3B8" },
  verified:   { label: "ドメイン認証済", bg: "#EFF3FC", color: "#002366", border: "#DCE5F7", dot: "#3B5FD9" },
  contracted: { label: "契約済み",       bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", dot: "#059669" },
};

const STATUS_TABS = [
  { key: "all",        label: "すべて" },
  { key: "contracted", label: "契約済み" },
  { key: "verified",   label: "ドメイン認証済" },
  { key: "none",       label: "未認証" },
];

type Company = {
  id: string;
  name: string | null;
  industry: string | null;
  location: string | null;
  employee_count: string | number | null;
  is_published: boolean;
  accepting_casual_meetings: boolean;
  listing_status: ListingStatus | null;
  engagement_status: EngagementStatus | null;
  jobs_public: boolean;
  verified_at: string | null;
  contracted_at: string | null;
  created_at: string;
  updated_at: string;
  sort_order: number | null;
  job_count?: number;
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const draggedIdRef = useRef<string | null>(null);

  const loadCompanies = useCallback(async () => {
    const supabase = createClient();

    const [{ data: companyRows }, { data: jobRows }] = await Promise.all([
      supabase
        .from("ow_companies")
        .select("id, name, industry, location, employee_count, is_published, accepting_casual_meetings, listing_status, engagement_status, jobs_public, verified_at, contracted_at, created_at, updated_at, sort_order")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false }),
      supabase
        .from("ow_jobs")
        .select("company_id"),
    ]);

    const jobCountMap = new Map<string, number>();
    for (const j of jobRows ?? []) {
      const cid = j.company_id as string;
      jobCountMap.set(cid, (jobCountMap.get(cid) ?? 0) + 1);
    }

    const rows: Company[] = (companyRows ?? []).map((c) => ({
      ...(c as Company),
      job_count: jobCountMap.get(c.id as string) ?? 0,
    }));

    setCompanies(rows);
    setLoading(false);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  // engagement_status 変更
  async function handleEngagementChange(company: Company, newStatus: EngagementStatus) {
    setActionLoading(company.id);
    const supabase = createClient();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      engagement_status: newStatus,
      updated_at: now,
    };
    if (newStatus === "verified"   && !company.verified_at)   updates.verified_at   = now;
    if (newStatus === "contracted" && !company.contracted_at) updates.contracted_at = now;
    // contracted/verified → none に戻す時は jobs_public も false に
    if (newStatus === "none") updates.jobs_public = false;
    // verified に戻す時も jobs_public = false（contracted のみ可）
    if (newStatus === "verified") updates.jobs_public = false;

    await supabase.from("ow_companies").update(updates).eq("id", company.id);
    setCompanies((prev) => prev.map((c) => c.id === company.id
      ? { ...c, engagement_status: newStatus,
          jobs_public: newStatus === "contracted" ? c.jobs_public : false,
          verified_at:  (newStatus === "verified"   && !c.verified_at)   ? now : c.verified_at,
          contracted_at: (newStatus === "contracted" && !c.contracted_at) ? now : c.contracted_at }
      : c
    ));
    setActionLoading(null);
  }

  // jobs_public トグル（engagement_status が contracted のときのみ操作可）
  async function handleJobsPublicToggle(company: Company) {
    const es = company.engagement_status ?? "none";
    if (es !== "contracted") return; // contracted のみ可
    const newValue = !company.jobs_public;
    setActionLoading(company.id);
    const supabase = createClient();
    await supabase.from("ow_companies").update({ jobs_public: newValue, updated_at: new Date().toISOString() }).eq("id", company.id);
    setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, jobs_public: newValue } : c));
    setActionLoading(null);
  }

  // is_published トグル (既存)
  async function handleTogglePublish(company: Company) {
    const newValue = !company.is_published;
    setActionLoading(company.id);
    const supabase = createClient();
    await supabase.from("ow_companies").update({ is_published: newValue, updated_at: new Date().toISOString() }).eq("id", company.id);
    setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, is_published: newValue } : c));
    setActionLoading(null);
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
    const supabase = createClient();
    await Promise.all(
      updated.map((c) =>
        supabase.from("ow_companies").update({ sort_order: c.sort_order }).eq("id", c.id)
      )
    );
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
            企業の掲載ステータス・求人公開許可・契約状態を管理します
          </p>
        </div>
        {/* KPI バッジ */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "契約済み",         count: contractedCount, bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
            { label: "ドメイン認証済",   count: verifiedCount,   bg: "#EFF3FC", color: "#002366", border: "#DCE5F7" },
            { label: "未認証",           count: noneCount,       bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
          ].map(({ label, count, bg, color, border }) => (
            <div key={label} style={{ textAlign: "center", padding: "8px 16px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "Inter, sans-serif", lineHeight: 1.2 }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 法的整理コール */}
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)" }}>設計原則:</strong> 企業概要は広く掲載可（ディレクトリ）。
        ドメイン認証（<code style={{ background: "#EFF3FC", color: "var(--royal)", padding: "1px 5px", borderRadius: 4 }}>verified</code>）で企業情報の編集が可能。
        規約同意（<code style={{ background: "#ECFDF5", color: "#059669", padding: "1px 5px", borderRadius: 4 }}>contracted</code>）のみ求人・面談OK公開・成果報酬請求可。
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="企業名・業界・所在地で検索..."
          style={{ width: "100%", padding: "9px 36px 9px 36px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#0F172A", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          onFocus={(e) => { e.target.style.borderColor = "#002366"; }}
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
              padding: "6px 14px", borderRadius: 100, border: `1px solid ${active ? "#002366" : "#E2E8F0"}`,
              background: active ? "#002366" : "#fff", color: active ? "#fff" : "#475569",
              fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              {tab.label}
              <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 100, background: active ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: active ? "#fff" : "#64748B" }}>
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
                {["", "企業名", "業界", "掲載", "企業ステータス", "求人・面談公開", "求人数", "ページ", "更新日"].map((h) => (
                  <th key={h} scope="col" style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--ink-mute)", fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-mute)", fontSize: 14 }}>
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
                          <span style={{ fontWeight: 600, color: "var(--royal)" }}>{c.name || "—"}</span>
                        </Link>
                      </td>

                      {/* 業界 */}
                      <td style={{ padding: "10px 14px", color: "var(--ink-soft)" }}>{c.industry || <span style={{ color: "var(--ink-mute)" }}>—</span>}</td>

                      {/* 掲載 (is_published) */}
                      <td style={{ padding: "10px 14px" }}>
                        <button type="button" onClick={() => handleTogglePublish(c)} disabled={isLoading}
                          style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, cursor: "pointer",
                            background: c.is_published ? "#ECFDF5" : "#F1F5F9",
                            color: c.is_published ? "#059669" : "#94A3B8",
                            border: `1px solid ${c.is_published ? "#A7F3D0" : "#E2E8F0"}`,
                            opacity: isLoading ? 0.5 : 1,
                          }}>
                          {c.is_published ? "掲載中" : "非掲載"}
                        </button>
                      </td>

                      {/* 企業ステータス（engagement_status） */}
                      <td style={{ padding: "10px 14px" }}>
                        <select
                          value={es}
                          disabled={isLoading}
                          onChange={(e) => handleEngagementChange(c, e.target.value as EngagementStatus)}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6,
                            background: esCfg.bg, color: esCfg.color, border: `1px solid ${esCfg.border}`,
                            cursor: "pointer", outline: "none", fontFamily: "inherit",
                            opacity: isLoading ? 0.5 : 1,
                          }}
                        >
                          <option value="none">未認証</option>
                          <option value="verified">ドメイン認証済</option>
                          <option value="contracted">契約済み</option>
                        </select>
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

                      {/* 求人・面談公開 (jobs_public) */}
                      <td style={{ padding: "10px 14px" }}>
                        {es !== "contracted" ? (
                          <span style={{ fontSize: 11, color: "var(--ink-mute)" }} title="契約済みのみ有効">🔒 {es === "verified" ? "要規約同意" : "要認証"}</span>
                        ) : (
                          <button type="button" onClick={() => handleJobsPublicToggle(c)} disabled={isLoading}
                            style={{
                              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 100, cursor: "pointer",
                              background: c.jobs_public ? "var(--royal)" : "#F1F5F9",
                              color: c.jobs_public ? "#fff" : "#64748B",
                              border: `1px solid ${c.jobs_public ? "var(--royal)" : "#E2E8F0"}`,
                              opacity: isLoading ? 0.5 : 1,
                            }}>
                            {c.jobs_public ? "✓ 公開中" : "非公開"}
                          </button>
                        )}
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
                        <Link href={`/companies/${c.id}`} target="_blank"
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
