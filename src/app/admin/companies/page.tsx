"use client";

import { useState, useEffect, useCallback } from "react";
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

const STATUS_TABS = [
  { key: "all",       label: "すべて" },
  { key: "published", label: "公開中" },
  { key: "private",   label: "非公開" },
];

type Company = {
  id: string;
  name: string | null;
  industry: string | null;
  location: string | null;
  employee_count: string | number | null;
  is_published: boolean;
  accepting_casual_meetings: boolean;
  created_at: string;
  updated_at: string;
  job_count?: number;
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    const supabase = createClient();

    // Fetch companies + job counts in parallel
    const [{ data: companyRows }, { data: jobRows }] = await Promise.all([
      supabase
        .from("ow_companies")
        .select("id, name, industry, location, employee_count, is_published, accepting_casual_meetings, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("ow_jobs")
        .select("company_id"),
    ]);

    // Build job count map
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

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // is_published トグル
  async function handleTogglePublish(company: Company) {
    const newValue = !company.is_published;
    setActionLoading(company.id);
    const supabase = createClient();
    await supabase
      .from("ow_companies")
      .update({ is_published: newValue, updated_at: new Date().toISOString() })
      .eq("id", company.id);
    setCompanies((prev) =>
      prev.map((c) => c.id === company.id ? { ...c, is_published: newValue } : c)
    );
    setActionLoading(null);
  }

  const filtered = companies.filter((c) => {
    if (activeTab === "published" && !c.is_published) return false;
    if (activeTab === "private" && c.is_published) return false;
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>企業管理</h1>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
              background: "var(--error)", color: "#fff",
              padding: "2px 7px", borderRadius: 4,
            }}>ADMIN</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
            登録企業の公開状態と基本情報を管理します
          </p>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          全{" "}
          <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>
            {companies.length}
          </strong>{" "}社 ·{" "}
          <span style={{ color: "var(--success)", fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
            {companies.filter((c) => c.is_published).length}
          </span>{" "}
          <span style={{ color: "var(--success)" }}>社公開中</span>
        </div>
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
          placeholder="企業名・業界・所在地で検索..."
          aria-label="企業を検索"
          style={{
            width: "100%", padding: "9px 36px 9px 36px",
            border: "1.5px solid #E2E8F0", borderRadius: 8,
            fontSize: 13, color: "#0F172A", background: "#fff",
            outline: "none", boxSizing: "border-box",
            fontFamily: "inherit", transition: "border-color 0.15s",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#002366"; }}
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }} role="tablist" aria-label="企業ステータスで絞り込み">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all"
            ? companies.length
            : tab.key === "published"
            ? companies.filter((c) => c.is_published).length
            : companies.filter((c) => !c.is_published).length;
          return (
            <button
              type="button"
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "6px 14px", borderRadius: 100,
                border: `1px solid ${activeTab === tab.key ? "#002366" : "#E2E8F0"}`,
                background: activeTab === tab.key ? "#002366" : "#fff",
                color: activeTab === tab.key ? "#fff" : "#475569",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 11, padding: "1px 6px", borderRadius: 100,
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
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--line)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
              {["企業名", "業界", "所在地", "従業員数", "求人数", "カジュアル面談", "公開状態", "更新日", "操作"].map((h) => (
                <th key={h} scope="col" style={{
                  textAlign: "left", padding: "10px 14px",
                  fontSize: 11, color: "var(--ink-mute)", fontWeight: 700,
                  letterSpacing: "0.05em", whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-mute)", fontSize: 14 }}>
                  <div style={{ marginBottom: 8, fontSize: 28 }}>🏢</div>
                  企業が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--line-soft)" }} className="admin-row">
                  {/* 企業名 */}
                  <td style={{ padding: "10px 14px" }}>
                    <Link
                      href={`/admin/companies/${c.id}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: getCompanyGradient(c.id),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: "#fff",
                      }}>
                        {(c.name || "?")[0]}
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--royal)" }}>
                        {c.name || "—"}
                      </span>
                    </Link>
                  </td>
                  {/* 業界 */}
                  <td style={{ padding: "10px 14px", color: "var(--ink-soft)" }}>{c.industry || <span style={{ color: "var(--ink-mute)" }}>—</span>}</td>
                  {/* 所在地 */}
                  <td style={{ padding: "10px 14px", color: "var(--ink-soft)" }}>{c.location || <span style={{ color: "var(--ink-mute)" }}>—</span>}</td>
                  {/* 従業員数 */}
                  <td style={{ padding: "10px 14px", color: "var(--ink-soft)" }}>{c.employee_count || <span style={{ color: "var(--ink-mute)" }}>—</span>}</td>
                  {/* 求人数 */}
                  <td style={{ padding: "10px 14px" }}>
                    {(c.job_count ?? 0) > 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100,
                        background: "var(--royal-50)", color: "var(--royal)",
                        fontFamily: "Inter, sans-serif",
                      }}>
                        {c.job_count}件
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  {/* カジュアル面談 */}
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                      background: c.accepting_casual_meetings ? "#ECFDF5" : "#F1F5F9",
                      color: c.accepting_casual_meetings ? "#059669" : "#94A3B8",
                    }}>
                      {c.accepting_casual_meetings ? "受付中" : "停止中"}
                    </span>
                  </td>
                  {/* 公開状態 */}
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                      background: c.is_published ? "#ECFDF5" : "#F1F5F9",
                      color: c.is_published ? "#059669" : "#94A3B8",
                      border: `1px solid ${c.is_published ? "#A7F3D0" : "#E2E8F0"}`,
                    }}>
                      {c.is_published ? "公開中" : "非公開"}
                    </span>
                  </td>
                  {/* 更新日 */}
                  <td style={{ padding: "10px 14px", color: "var(--ink-mute)", fontSize: 11, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>
                    {new Date(c.updated_at).toLocaleDateString("ja-JP")}
                  </td>
                  {/* 操作 */}
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(c)}
                      disabled={actionLoading === c.id}
                      style={{
                        padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", whiteSpace: "nowrap",
                        opacity: actionLoading === c.id ? 0.5 : 1,
                        background: c.is_published ? "#FEE2E2" : "#EFF3FC",
                        border: `1px solid ${c.is_published ? "#FCA5A5" : "#B2C4F0"}`,
                        color: c.is_published ? "#DC2626" : "#002366",
                      }}
                    >
                      {c.is_published ? "非公開にする" : "公開する"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-row:hover { background: var(--bg-tint); }
        .admin-row:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
}
