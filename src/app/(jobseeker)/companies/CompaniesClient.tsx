"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { CompanyLogo } from "@/components/jobseeker/CompanyLogo";
import type { CompanyListRow } from "@/lib/supabase/queries";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";

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


function deriveRemoteTags(remoteStatus: string | null): string[] {
  if (!remoteStatus) return [];
  const s = remoteStatus.toLowerCase();
  if (s.includes("full_remote") || s.includes("フルリモート")) return ["フルリモート"];
  if (s.includes("hybrid") || s.includes("ハイブリッド")) return ["ハイブリッド"];
  return [];
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: CompanyListRow }) {

  const metaParts = [
    company.industry || null,
    company.phase || null,
  ].filter(Boolean);

  const remoteTags = deriveRemoteTags(company.remote_work_status);
  const hasTags = remoteTags.length > 0 || company.accepting_casual_meetings;

  // カバーエリア: 写真 or 統一グラデーション（バラバラな色を避けるため navy 系に統一）
  // ロゴアバターには logo_gradient をそのまま使う（小さいため色の多様性はOK）
  const fallbackGradient = "linear-gradient(135deg, #001233 0%, var(--royal) 60%, #1a3569 100%)";

  return (
    <Link href={`/companies/${company.id}`} prefetch={true} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <article
        className="company-card"
        style={{
          background: "#fff",
          border: `1px solid ${company.accepting_casual_meetings ? "#A7F3D0" : "var(--line)"}`,
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
          cursor: "pointer",
        }}
      >
        {/* ── Cover banner: photo or gradient ── */}
        <div style={{
          position: "relative",
          height: 120,
          flexShrink: 0,
          background: company.cover_photo_url ? undefined : fallbackGradient,
          overflow: "hidden",
        }}>
          {company.cover_photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.cover_photo_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {/* 面談受付中バッジ（右上） */}
          {company.accepting_casual_meetings && (
            <span style={{
              position: "absolute", top: 10, right: 10,
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700,
              padding: "3px 10px", borderRadius: 100,
              background: "rgba(255,255,255,0.92)",
              color: "var(--success)",
              backdropFilter: "blur(4px)",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "var(--success)", flexShrink: 0,
                animation: "pulseDot 1.8s ease-in-out infinite",
              }} />
              面談受付中
            </span>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "0 var(--space-4) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)", flex: 1 }}>
          {/* Logo + name: ロゴをカバー下端に重ねて表示 */}
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", marginTop: -20 }}>
            <div style={{
              flexShrink: 0,
              border: "3px solid #fff",
              borderRadius: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              lineHeight: 0,
            }}>
              <CompanyLogo
                name={company.name}
                logoUrl={company.logo_url}
                logoLetter={company.logo_letter}
                logoGradient={company.logo_gradient}
                size={44}
                borderRadius={9}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
              <div style={{
                fontSize: "var(--text-base)", fontWeight: 600, color: "var(--ink)",
                lineHeight: 1.3, marginBottom: 2,
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
            fontSize: "var(--text-sm)",
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

          {/* Remote tags */}
          {hasTags && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {remoteTags.map((t) => (
                <span key={t} style={{
                  fontSize: 10, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 100,
                  background: "var(--royal-50)", color: "var(--royal)",
                }}>{t}</span>
              ))}
            </div>
          )}

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
    background: "#fff", fontSize: "var(--text-sm)", fontWeight: 500,
    cursor: "pointer", fontFamily: "Inter, sans-serif",
    transition: "border-color 0.1s, background 0.1s, color 0.1s",
  };

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", paddingTop: 48 }}>
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        aria-label="前のページへ"
        style={{ ...btnBase, minWidth: 80, color: "var(--ink-soft)", opacity: current <= 1 ? 0.4 : 1, cursor: current <= 1 ? "default" : "pointer" }}
      >
        ← 前へ
      </button>

      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <button
          type="button"
          key={p}
          onClick={() => onChange(p)}
          aria-label={`${p}ページ目`}
          aria-current={p === current ? "page" : undefined}
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
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current >= total}
        aria-label="次のページへ"
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
    height: 38, padding: "0 var(--space-2)",
    border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
    borderRadius: 8, fontSize: "var(--text-sm)",
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
  const prefecture = searchParams.get("prefecture") ?? "";
  const hiring = searchParams.get("hiring") === "1";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // Local search query (not in URL — instant, no round trip needed)
  const [q, setQ] = useState("");

  // Layout toggle (grid = 3 列, list = 1 列)
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  // Secondary filter visibility — auto-open when a secondary filter is active
  const hasSecondaryFilter = !!(remote || prefecture);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const secondaryVisible = showMoreFilters || hasSecondaryFilter;

  // Scroll shadow for sticky filter bar
  const [filterBarScrolled, setFilterBarScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setFilterBarScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 実データに含まれる都道府県のみ (北から南順)
  const availablePrefectures = useMemo(() => {
    const prefSet = new Set<string>();
    companies.forEach((c) => {
      const p = extractPrefecture(c.location);
      if (p) prefSet.add(p);
    });
    return PREFECTURES.filter((p) => prefSet.has(p));
  }, [companies]);

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

    // Prefecture: exact match on extracted prefecture
    if (prefecture) {
      list = list.filter((c) => extractPrefecture(c.location) === prefecture);
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
  }, [companies, q, industry, remote, prefecture, hiring, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const hasFilters = !!(industry || remote || prefecture || hiring || q.trim());

  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* ── Page hero ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, var(--royal) 55%, #1a3569 100%)",
        padding: "40px 0 36px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -80, top: -120, width: 440, height: 440, borderRadius: "50%", background: "rgba(59,95,217,0.12)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -60, bottom: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(245,158,11,0.06)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-5 md:px-12">
          {/* Eyebrow */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", marginBottom: "var(--space-3)", textTransform: "uppercase" }}>
            COMPANIES
          </div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(24px, 3.5vw, 34px)",
            fontWeight: 700, color: "#fff", lineHeight: 1.35, marginBottom: "var(--space-4)",
          }}>
            IT/SaaS 企業を探す
          </h1>
          {/* Stats chips */}
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              {companies.length}社掲載中
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
              編集部が取材・審査済み
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              全社カジュアル面談受付中
            </span>
          </div>
          {/* OPINIO differentiators */}
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {[
              { icon: "👥", label: "現役社員に相談できる" },
              { icon: "🎓", label: "OB・OGの話が聞ける" },
              { icon: "🌟", label: "メンターにも相談可能" },
            ].map(({ icon, label }) => (
              <span key={label} style={{
                fontSize: 12, fontWeight: 500,
                color: "rgba(255,255,255,0.7)",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <span>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky filter bar ─────────────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "var(--space-2) 48px", position: "sticky", top: 60, zIndex: 50,
        boxShadow: filterBarScrolled ? "0 4px 12px rgba(0,35,102,0.07)" : "none",
        transition: "box-shadow 0.2s ease",
      }} className="px-5 md:px-12">
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap",
        }}>
          {/* Search input */}
          <div role="search" style={{ position: "relative", flex: "1 1 180px", minWidth: 140, maxWidth: 260 }}>
            <input
              type="search"
              aria-label="企業名・キーワードで検索"
              placeholder="企業名・キーワードで検索..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: "100%", height: 38,
                padding: q ? "0 32px 0 12px" : "0 12px",
                border: "1px solid var(--line)", borderRadius: 8,
                fontSize: "var(--text-sm)", color: "var(--ink)", outline: "none", background: "#fff",
                boxSizing: "border-box",
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="検索をクリア"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-mute)", fontSize: "var(--text-md)", lineHeight: 1, padding: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* 面談受付中 chip */}
          <button
            type="button"
            onClick={() => setParam("hiring", hiring ? "" : "1")}
            aria-pressed={hiring}
            style={{
              height: 38, padding: "0 14px", borderRadius: 8, fontSize: "var(--text-sm)", fontWeight: 500,
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
            aria-label="業界で絞り込み"
          >
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* 詳細フィルター toggle */}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            style={{
              height: 38, padding: "0 12px", borderRadius: 8, fontSize: "var(--text-sm)", fontWeight: 500,
              border: `1px solid ${hasSecondaryFilter ? "var(--royal)" : "var(--line)"}`,
              background: hasSecondaryFilter ? "var(--royal-50)" : "#fff",
              color: hasSecondaryFilter ? "var(--royal)" : "var(--ink-mute)",
              cursor: "pointer", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            詳細
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5}
              style={{ transition: "transform 0.2s", transform: secondaryVisible ? "rotate(180deg)" : "none" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Secondary filters: 都道府県 + 働き方 */}
          {secondaryVisible && (
            <>
              <select
                value={prefecture}
                onChange={(e) => setParam("prefecture", e.target.value)}
                style={filterSelectStyle(!!prefecture)}
                aria-label="都道府県で絞り込み"
              >
                <option value="">すべての都道府県</option>
                {availablePrefectures.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={remote}
                onChange={(e) => setParam("remote", e.target.value)}
                style={filterSelectStyle(!!remote)}
                aria-label="リモートワークで絞り込み"
              >
                {REMOTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </>
          )}

          {/* Sort + Layout toggle — pushed to the right */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}
              aria-label="並び順"
              style={filterSelectStyle(false)}
            >
              <option value="newest">更新日順</option>
              <option value="alpha">名前順</option>
            </select>

            {/* Layout toggle buttons */}
            <button
              type="button"
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
              type="button"
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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--space-8) 48px 64px" }} className="px-5 md:px-12">
        {/* Count + clear filters */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "var(--space-4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span
              aria-live="polite"
              aria-atomic="true"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: hasFilters ? "5px 14px" : "0",
                borderRadius: 100,
                background: hasFilters ? "var(--royal-50)" : "transparent",
                border: hasFilters ? "1px solid var(--royal-100)" : "none",
                transition: "all 0.2s",
              }}>
              <strong style={{ fontSize: "var(--text-lg)", color: "var(--royal)", fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
                {filtered.length}
              </strong>
              <span style={{ fontSize: "var(--text-base)", color: hasFilters ? "var(--royal)" : "var(--ink-soft)" }}>
                {hasFilters ? "社 該当" : "社が該当"}
              </span>
            </span>
            {hasFilters && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                background: "var(--royal)", color: "#fff",
                letterSpacing: "0.03em",
              }}>
                フィルター適用中
              </span>
            )}
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setQ(""); router.replace("/companies"); }}
              style={{
                fontSize: 12, color: "var(--ink-mute)", background: "none",
                border: "none", cursor: "pointer", textDecoration: "underline", padding: 0,
              }}
            >
              クリア
            </button>
          )}
        </div>

        {/* Company grid */}
        {paged.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "64px 0", background: "#fff",
            borderRadius: 16, border: "1px solid var(--line)", marginTop: "var(--space-4)",
          }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--ink)", marginBottom: "var(--space-2)" }}>条件に合う企業が見つかりませんでした</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: "var(--space-4)" }}>フィルター条件を変えてみてください</p>
            <button type="button" onClick={() => { setQ(""); router.replace("/companies"); }} style={{
              padding: "var(--space-2) var(--space-6)", borderRadius: 8, background: "var(--royal)",
              color: "#fff", border: "none", fontSize: "var(--text-base)", fontWeight: 600, cursor: "pointer",
            }}>
              すべてリセット
            </button>
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
          box-shadow: 0 8px 24px rgba(0,35,102,0.10);
          transform: translateY(-2px);
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
