"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { CompanyLogo } from "@/components/jobseeker/CompanyLogo";
import type { CompanyListRow } from "@/lib/supabase/queries";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 9;

const INDUSTRY_OPTIONS = [
  { value: "", label: "すべての業界" },
  { value: "SaaS", label: "SaaS" },
  { value: "FinTech", label: "FinTech" },
  { value: "HR Tech", label: "HR Tech" },
  { value: "AI", label: "AI / LLM" },
  { value: "ヘルス", label: "HealthTech" },
  { value: "EC", label: "EC・クラウド" },
];

const REMOTE_OPTIONS = [
  { value: "", label: "すべての働き方" },
  { value: "full_remote", label: "フルリモート" },
  { value: "hybrid", label: "ハイブリッド" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function formatUpdated(days: number): string {
  if (days === 0) return "今日更新";
  if (days <= 7) return `${days}日前`;
  if (days <= 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

function deriveRemoteTags(remoteStatus: string | null): string[] {
  if (!remoteStatus) return [];
  const s = remoteStatus.toLowerCase();
  if (s.includes("full_remote") || s.includes("フルリモート")) return ["フルリモート"];
  if (s.includes("hybrid") || s.includes("ハイブリッド")) return ["ハイブリッド"];
  return [];
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: CompanyListRow }) {
  const days = daysSince(company.updated_at);
  const isFresh = days <= 7;
  const freshLabel = formatUpdated(days);

  const metaParts = [
    company.industry || null,
    company.phase || null,
    company.employee_count > 0 ? `${company.employee_count.toLocaleString()}名` : null,
  ].filter(Boolean);

  const remoteTags = deriveRemoteTags(company.remote_work_status);
  const hasTags = remoteTags.length > 0 || company.accepting_casual_meetings;

  return (
    <Link href={`/companies/${company.id}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <article
        className="company-card"
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          height: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
          cursor: "pointer",
        }}
      >
        {/* Header: logo + name + meta */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            logoLetter={company.logo_letter}
            logoGradient={company.logo_gradient}
            size={44}
            borderRadius={10}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: "var(--ink)",
              lineHeight: 1.3, marginBottom: 3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {company.name}
            </div>
            {metaParts.length > 0 && (
              <div style={{
                fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {metaParts.join(" · ")}
              </div>
            )}
          </div>
        </div>

        {/* Tagline */}
        <p style={{
          fontSize: 13,
          lineHeight: 1.8,
          color: "var(--ink-soft)",
          flex: 1,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        } as React.CSSProperties}>
          {company.tagline || "詳細情報は企業ページをご覧ください"}
        </p>

        {/* Tags */}
        {hasTags && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {remoteTags.map((t) => (
              <span key={t} style={{
                fontSize: 10, fontWeight: 600,
                padding: "2px 8px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
              }}>{t}</span>
            ))}
            {company.accepting_casual_meetings && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                padding: "2px 8px", borderRadius: 100,
                background: "var(--success-soft)", color: "var(--success)",
              }}>面談受付中</span>
            )}
          </div>
        )}

        {/* Footer: job count + freshness */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 12, borderTop: "1px solid var(--line-soft)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontSize: 20, fontWeight: 700,
              color: company.job_count > 0 ? "var(--royal)" : "var(--ink-mute)",
              fontFamily: "Inter, sans-serif",
            }}>
              {company.job_count}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>件の求人</span>
          </div>
          <span style={{
            fontSize: 11,
            color: isFresh ? "var(--success)" : "var(--ink-mute)",
            fontWeight: isFresh ? 600 : 400,
          }}>
            {freshLabel}
          </span>
        </div>
      </article>
    </Link>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ current, total, onChange }: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 1) return null;

  const btnBase: React.CSSProperties = {
    height: 38, borderRadius: 8, border: "1px solid var(--line)",
    background: "#fff", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "Inter, sans-serif",
    transition: "border-color 0.1s, background 0.1s, color 0.1s",
  };

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", paddingTop: 48 }}>
      <button
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        style={{ ...btnBase, minWidth: 80, color: "var(--ink-soft)", opacity: current <= 1 ? 0.4 : 1, cursor: current <= 1 ? "default" : "pointer" }}
      >
        ← 前へ
      </button>

      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            ...btnBase,
            minWidth: 38,
            background: p === current ? "var(--royal)" : "#fff",
            border: `1px solid ${p === current ? "var(--royal)" : "var(--line)"}`,
            color: p === current ? "#fff" : "var(--ink-soft)",
          }}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => onChange(current + 1)}
        disabled={current >= total}
        style={{ ...btnBase, minWidth: 80, color: "var(--ink-soft)", opacity: current >= total ? 0.4 : 1, cursor: current >= total ? "default" : "pointer" }}
      >
        次へ →
      </button>
    </div>
  );
}

// ─── Select style helper ──────────────────────────────────────────────────────

function filterSelectStyle(active: boolean): React.CSSProperties {
  return {
    height: 38, padding: "0 10px",
    border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
    borderRadius: 8, fontSize: 13,
    color: active ? "var(--royal)" : "var(--ink-soft)",
    background: "#fff", cursor: "pointer",
    fontWeight: active ? 600 : 400,
    outline: "none",
  };
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function CompaniesClient({ companies }: { companies: CompanyListRow[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL-driven filter state
  const industry = searchParams.get("industry") ?? "";
  const remote = searchParams.get("remote") ?? "";
  const hiring = searchParams.get("hiring") === "1";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // Local search query (not in URL — instant, no round trip needed)
  const [q, setQ] = useState("");

  // Layout toggle (grid = 3 列, list = 1 列)
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // reset to page 1 on filter change
    router.replace(`/companies?${params.toString()}`);
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    router.replace(`/companies?${params.toString()}`);
  }

  // Filter + sort pipeline (runs entirely client-side)
  const filtered = useMemo(() => {
    let list = [...companies];

    // Text search: name + tagline (simple includes, case-insensitive)
    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(lq) ||
          c.tagline.toLowerCase().includes(lq)
      );
    }

    // Industry: partial match against DB industry string
    if (industry) {
      list = list.filter((c) =>
        c.industry.toLowerCase().includes(industry.toLowerCase())
      );
    }

    // Remote work: partial match against remote_work_status
    if (remote) {
      list = list.filter(
        (c) => c.remote_work_status?.toLowerCase().includes(remote.toLowerCase()) ?? false
      );
    }

    // Hiring (casual meetings only)
    if (hiring) {
      list = list.filter((c) => c.accepting_casual_meetings);
    }

    // Sort
    if (sort === "alpha") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "ja"));
    }
    // "newest" is already sorted by updated_at DESC from DB

    return list;
  }, [companies, q, industry, remote, hiring, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const hasFilters = !!(industry || remote || hiring || q.trim());

  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "40px 48px 32px",
      }} className="px-5 md:px-12">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 10 }}>
            Opinio / 企業を知る
          </div>
          <h1 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 500, color: "var(--ink)", lineHeight: 1.3, marginBottom: 12,
          }}>
            企業を、知る。
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.8, maxWidth: "var(--max-w-form)" }}>
            IT/SaaS業界の求人・組織文化・カジュアル面談情報を、まとめて確認。
          </p>
        </div>
      </div>

      {/* ── Sticky filter bar ─────────────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "10px 48px", position: "sticky", top: 60, zIndex: 50,
      }} className="px-5 md:px-12">
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
        }}>
          {/* Search input */}
          <input
            type="text"
            placeholder="企業名・キーワードで検索..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: "1 1 180px", minWidth: 140, maxWidth: 260, height: 38,
              padding: "0 12px", border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, color: "var(--ink)", outline: "none", background: "#fff",
            }}
          />

          {/* 面談受付中 chip */}
          <button
            onClick={() => setParam("hiring", hiring ? "" : "1")}
            style={{
              height: 38, padding: "0 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: `1px solid ${hiring ? "var(--royal)" : "var(--line)"}`,
              background: hiring ? "var(--royal)" : "#fff",
              color: hiring ? "#fff" : "var(--ink-soft)",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            面談受付中
          </button>

          {/* 業界 dropdown */}
          <select
            value={industry}
            onChange={(e) => setParam("industry", e.target.value)}
            style={filterSelectStyle(!!industry)}
          >
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* 働き方 dropdown */}
          <select
            value={remote}
            onChange={(e) => setParam("remote", e.target.value)}
            style={filterSelectStyle(!!remote)}
          >
            {REMOTE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Sort + Layout toggle — pushed to the right */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}
              style={filterSelectStyle(false)}
            >
              <option value="newest">更新日順</option>
              <option value="alpha">名前順</option>
            </select>

            {/* Layout toggle buttons */}
            <button
              onClick={() => setLayout("grid")}
              aria-label="3 列で表示"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 38, height: 38,
                border: `1px solid ${layout === "grid" ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: layout === "grid" ? "var(--royal-50)" : "#fff",
                color: layout === "grid" ? "var(--royal)" : "var(--ink-mute)",
                cursor: "pointer",
              }}
            >
              <LayoutGrid size={16} strokeWidth={2} />
            </button>
            <button
              onClick={() => setLayout("list")}
              aria-label="1 列で表示"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 38, height: 38,
                border: `1px solid ${layout === "list" ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: layout === "list" ? "var(--royal-50)" : "#fff",
                color: layout === "list" ? "var(--royal)" : "var(--ink-mute)",
                cursor: "pointer",
              }}
            >
              <List size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Result area ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px 64px" }} className="px-5 md:px-12">
        {/* Count + clear filters */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
            <strong style={{ fontSize: 20, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>
              {filtered.length}
            </strong>
            {" "}社が該当
          </p>
          {hasFilters && (
            <button
              onClick={() => { setQ(""); router.replace("/companies"); }}
              style={{
                fontSize: 12, color: "var(--ink-mute)", background: "none",
                border: "none", cursor: "pointer", textDecoration: "underline", padding: 0,
              }}
            >
              フィルターをクリア
            </button>
          )}
        </div>

        {/* Company grid */}
        {paged.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0",
            color: "var(--ink-mute)", fontSize: 15,
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
            <div>該当する企業が見つかりませんでした</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>検索条件を変えてお試しください</div>
          </div>
        ) : (
          <div className={`grid gap-5 grid-cols-1${layout === "grid" ? " sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
            {paged.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination current={safePage} total={totalPages} onChange={goPage} />
      </div>

      <style>{`
        .company-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 24px rgba(0,35,102,0.08) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
