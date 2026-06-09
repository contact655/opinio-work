"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

type CompareEntry = {
  id: string;
  name: string;
  initial: string;
  gradient: string;
};

type CompanyRow = {
  id: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  logo_letter: string | null;
  logo_gradient: string | null;
  phase: string | null;
  industry: string | null;
  employee_count: string | null;
  founded_year: number | null;
  location: string | null;
  remote_work_status: string | null;
  flex_time: boolean | null;
  side_job_ok: boolean | null;
  accepting_casual_meetings: boolean | null;
  avg_salary: number | null;
  avg_age: number | null;
  female_ratio: number | null;
  company_features: string[] | null;
  fit_positives: string | null;
  fit_negatives: string | null;
  why_join: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "opinio-compare-companies";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSalary(n: number | null): string {
  if (!n) return "—";
  return `¥${(n / 10000).toFixed(0)}万円`;
}

function formatPhase(phase: string | null): string {
  if (!phase) return "—";
  const map: Record<string, string> = {
    seed: "シード",
    series_a: "シリーズA",
    series_b: "シリーズB",
    series_c: "シリーズC",
    pre_ipo: "Pre-IPO",
    ipo: "上場",
    listed: "上場",
    growth: "グロース",
  };
  return map[phase.toLowerCase()] ?? phase;
}

function formatEmployeeCount(count: string | null): string {
  if (!count) return "—";
  return count;
}

function getRemoteLabel(status: string | null): string {
  if (!status) return "—";
  const lower = status.toLowerCase();
  if (lower.includes("フルリモート") || lower.includes("full_remote")) return "フルリモート可";
  if (lower.includes("ハイブリッド") || lower.includes("hybrid")) return "ハイブリッド";
  if (lower.includes("出社") || lower.includes("on_site")) return "出社中心";
  return status;
}

function getLogoGradient(row: CompanyRow): string {
  return row.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)";
}

function getLogoLetter(row: CompanyRow): string {
  return row.logo_letter ?? (row.name ? row.name[0] : "?");
}

// ── Check / Cross icons ───────────────────────────────────────────────────────

function Check() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: "var(--success-soft, #ECFDF5)",
      color: "var(--success, #059669)",
      fontSize: 13,
      fontWeight: 700,
    }}>✓</span>
  );
}

function Cross() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: "var(--error-soft, #FEE2E2)",
      color: "var(--error, #DC2626)",
      fontSize: 13,
      fontWeight: 700,
    }}>✗</span>
  );
}

function BoolCell({ value }: { value: boolean | null }) {
  if (value === null || value === undefined) return <span style={{ color: "var(--ink-mute)" }}>—</span>;
  return value ? <Check /> : <Cross />;
}

// ── Row components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      padding: "10px 16px",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--ink-soft)",
      background: "var(--bg-tint)",
      whiteSpace: "nowrap",
      minWidth: 120,
      verticalAlign: "middle",
      borderBottom: "1px solid var(--line)",
      borderRight: "1px solid var(--line)",
    }}>
      {children}
    </td>
  );
}

function DataCell({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      padding: "10px 16px",
      fontSize: 13,
      color: "var(--ink)",
      textAlign: "center",
      verticalAlign: "middle",
      borderBottom: "1px solid var(--line)",
      borderRight: "1px solid var(--line-soft)",
    }}>
      {children}
    </td>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CompareClient() {
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      setEntries(Array.isArray(stored) ? stored : []);
    } catch {
      setEntries([]);
    }
  }, []);

  // Fetch company details from Supabase
  useEffect(() => {
    if (!mounted) return;
    if (entries.length === 0) {
      setLoading(false);
      return;
    }

    const ids = entries.map((e) => e.id);
    const supabase = createClient();

    supabase
      .from("ow_companies")
      .select(
        "id, name, tagline, logo_url, logo_letter, logo_gradient, phase, industry, " +
        "employee_count, founded_year, location, remote_work_status, flex_time, " +
        "side_job_ok, accepting_casual_meetings, avg_salary, avg_age, female_ratio, " +
        "company_features, fit_positives, fit_negatives, why_join"
      )
      .in("id", ids)
      .then(({ data, error }) => {
        if (error || !data) {
          setLoading(false);
          return;
        }
        // Cast to our local type and preserve the order from localStorage
        const rows = data as unknown as CompanyRow[];
        const ordered = ids
          .map((id) => rows.find((row) => row.id === id))
          .filter((row): row is CompanyRow => row !== undefined);
        setCompanies(ordered);
        setLoading(false);
      });
  }, [mounted, entries]);

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!mounted || (mounted && !loading && entries.length === 0)) {
    return (
      <div style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
        <h1 style={{
          fontFamily: '"Noto Serif JP", serif',
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          marginBottom: 12,
        }}>
          比較する企業を選んでください
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.7 }}>
          企業一覧ページで「比較」ボタンを押すと、最大3社を横並びで比較できます。
        </p>
        <Link
          href="/companies"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 28px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #002366, #3B5FD9)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          ← 企業一覧に戻る
        </Link>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        flexDirection: "column",
        gap: 12,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid var(--line)",
          borderTopColor: "var(--royal)",
          animation: "spin 0.7s linear infinite",
        }} />
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>企業情報を取得中...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const colCount = companies.length;

  return (
    <>
      <style>{`
        .compare-table { width: 100%; border-collapse: collapse; }
        .compare-table tr:hover td { background: rgba(0,35,102,0.02); }
        .compare-header-sticky {
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .compare-section-header td {
          background: var(--royal-50, #EFF3FC) !important;
          color: var(--royal, #002366) !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: 0.05em !important;
          text-transform: uppercase;
          padding: 6px 16px !important;
        }
        .compare-tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          background: var(--royal-50);
          color: var(--royal);
          margin: 2px 2px;
          border: 1px solid var(--royal-100);
        }
        @media (max-width: 640px) {
          .compare-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .compare-label-col { min-width: 110px !important; }
          .compare-data-col { min-width: 150px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px 80px" }}>
        {/* ── Page Header ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "28px 0 24px",
          flexWrap: "wrap",
        }}>
          <div>
            <Link
              href="/companies"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: "var(--ink-soft)",
                textDecoration: "none",
                marginBottom: 8,
              }}
            >
              ← 企業一覧に戻る
            </Link>
            <h1 style={{
              fontFamily: '"Noto Serif JP", serif',
              fontSize: 22,
              fontWeight: 700,
              color: "var(--ink)",
              margin: 0,
            }}>
              企業比較{" "}
              <span style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--ink-soft)",
              }}>
                ({colCount}社)
              </span>
            </h1>
          </div>
          <Link
            href="/companies"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 9,
              border: "1.5px solid var(--line)",
              background: "#fff",
              color: "var(--ink-soft)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            + 企業を追加する
          </Link>
        </div>

        {/* ── Table ── */}
        <div
          className="compare-wrapper"
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid var(--line)",
            overflow: "hidden",
            boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
          }}
        >
          <table className="compare-table">
            <colgroup>
              <col className="compare-label-col" style={{ width: 140 }} />
              {companies.map((c) => (
                <col key={c.id} className="compare-data-col" />
              ))}
            </colgroup>
            <thead>
              {/* ── Sticky company header row ── */}
              <tr className="compare-header-sticky">
                <td style={{
                  padding: "16px",
                  background: "var(--bg-tint)",
                  borderBottom: "2px solid var(--line)",
                  borderRight: "1px solid var(--line)",
                }} />
                {companies.map((company) => (
                  <td
                    key={company.id}
                    style={{
                      padding: 0,
                      borderBottom: "2px solid var(--line)",
                      borderRight: "1px solid var(--line-soft)",
                      verticalAlign: "top",
                    }}
                  >
                    {/* Company header card */}
                    <div style={{
                      background: getLogoGradient(company),
                      padding: "20px 16px 16px",
                    }}>
                      {/* Logo */}
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            objectFit: "contain",
                            background: "#fff",
                            padding: 4,
                            display: "block",
                            marginBottom: 10,
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.18)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          fontWeight: 800,
                          color: "#fff",
                          fontFamily: "Inter, sans-serif",
                          marginBottom: 10,
                        }}>
                          {getLogoLetter(company)}
                        </div>
                      )}
                      {/* Company name */}
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#fff",
                        lineHeight: 1.3,
                        marginBottom: 4,
                      }}>
                        {company.name}
                      </div>
                      {company.tagline && (
                        <div style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.72)",
                          lineHeight: 1.4,
                        }}>
                          {company.tagline}
                        </div>
                      )}
                    </div>
                    {/* CTA buttons */}
                    <div style={{
                      display: "flex",
                      gap: 6,
                      padding: "10px 12px",
                      borderTop: "1px solid var(--line-soft)",
                      background: "#fff",
                    }}>
                      <Link
                        href={`/companies/${company.id}`}
                        style={{
                          flex: 1,
                          display: "block",
                          textAlign: "center",
                          padding: "7px 4px",
                          borderRadius: 7,
                          fontSize: 11,
                          fontWeight: 600,
                          background: "var(--royal-50)",
                          color: "var(--royal)",
                          textDecoration: "none",
                          border: "1px solid var(--royal-100)",
                        }}
                      >
                        詳細を見る
                      </Link>
                      {company.accepting_casual_meetings && (
                        <Link
                          href={`/companies/${company.id}/casual-meeting`}
                          style={{
                            flex: 1,
                            display: "block",
                            textAlign: "center",
                            padding: "7px 4px",
                            borderRadius: 7,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "linear-gradient(135deg, #F59E0B, #D97706)",
                            color: "#fff",
                            textDecoration: "none",
                          }}
                        >
                          話を聞く
                        </Link>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ── Section: 基本情報 ── */}
              <tr className="compare-section-header">
                <td colSpan={colCount + 1}>基本情報</td>
              </tr>
              <tr>
                <SectionLabel>業種</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>{c.industry ?? "—"}</DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>フェーズ</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>
                    {c.phase ? (
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 100,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "var(--royal-50)",
                        color: "var(--royal)",
                        border: "1px solid var(--royal-100)",
                      }}>
                        {formatPhase(c.phase)}
                      </span>
                    ) : "—"}
                  </DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>社員数</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>{formatEmployeeCount(c.employee_count)}</DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>設立</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>
                    {c.founded_year ? `${c.founded_year}年` : "—"}
                  </DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>所在地</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>{c.location ?? "—"}</DataCell>
                ))}
              </tr>

              {/* ── Section: 働き方 ── */}
              <tr className="compare-section-header">
                <td colSpan={colCount + 1}>働き方</td>
              </tr>
              <tr>
                <SectionLabel>リモートワーク</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>{getRemoteLabel(c.remote_work_status)}</DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>フレックス</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}><BoolCell value={c.flex_time} /></DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>副業OK</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}><BoolCell value={c.side_job_ok} /></DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>面談受付</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}><BoolCell value={c.accepting_casual_meetings} /></DataCell>
                ))}
              </tr>

              {/* ── Section: 報酬・カルチャー ── */}
              <tr className="compare-section-header">
                <td colSpan={colCount + 1}>報酬・カルチャー</td>
              </tr>
              <tr>
                <SectionLabel>平均年収</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>
                    {c.avg_salary ? (
                      <span style={{
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 700,
                        color: "var(--success)",
                        fontSize: 14,
                      }}>
                        {formatSalary(c.avg_salary)}
                      </span>
                    ) : "—"}
                  </DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>平均年齢</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>
                    {c.avg_age ? (
                      <span style={{ fontFamily: "Inter, sans-serif" }}>{c.avg_age}歳</span>
                    ) : "—"}
                  </DataCell>
                ))}
              </tr>
              <tr>
                <SectionLabel>女性比率</SectionLabel>
                {companies.map((c) => (
                  <DataCell key={c.id}>
                    {c.female_ratio != null ? (
                      <span style={{ fontFamily: "Inter, sans-serif" }}>{c.female_ratio}%</span>
                    ) : "—"}
                  </DataCell>
                ))}
              </tr>

              {/* company_features — only if any company has them */}
              {companies.some((c) => c.company_features && c.company_features.length > 0) && (
                <tr>
                  <SectionLabel>特徴</SectionLabel>
                  {companies.map((c) => (
                    <DataCell key={c.id}>
                      {c.company_features && c.company_features.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2 }}>
                          {c.company_features.slice(0, 4).map((tag, i) => (
                            <span key={i} className="compare-tag">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : "—"}
                    </DataCell>
                  ))}
                </tr>
              )}

              {/* ── Section: OPINIO評価 ── */}
              {companies.some((c) => c.fit_positives || c.fit_negatives || c.why_join) && (
                <>
                  <tr className="compare-section-header">
                    <td colSpan={colCount + 1}>OPINIO評価</td>
                  </tr>
                  {companies.some((c) => c.fit_positives) && (
                    <tr>
                      <SectionLabel>おすすめポイント</SectionLabel>
                      {companies.map((c) => (
                        <DataCell key={c.id}>
                          {c.fit_positives ? (
                            <p style={{
                              fontSize: 12,
                              color: "var(--ink-soft)",
                              lineHeight: 1.6,
                              textAlign: "left",
                              margin: 0,
                            }}>
                              {c.fit_positives.length > 120
                                ? c.fit_positives.slice(0, 120) + "…"
                                : c.fit_positives}
                            </p>
                          ) : "—"}
                        </DataCell>
                      ))}
                    </tr>
                  )}
                  {companies.some((c) => c.why_join) && (
                    <tr>
                      <SectionLabel>入社理由</SectionLabel>
                      {companies.map((c) => (
                        <DataCell key={c.id}>
                          {c.why_join ? (
                            <p style={{
                              fontSize: 12,
                              color: "var(--ink-soft)",
                              lineHeight: 1.6,
                              textAlign: "left",
                              margin: 0,
                            }}>
                              {c.why_join.length > 120
                                ? c.why_join.slice(0, 120) + "…"
                                : c.why_join}
                            </p>
                          ) : "—"}
                        </DataCell>
                      ))}
                    </tr>
                  )}
                  {companies.some((c) => c.fit_negatives) && (
                    <tr>
                      <SectionLabel>注意点</SectionLabel>
                      {companies.map((c) => (
                        <DataCell key={c.id}>
                          {c.fit_negatives ? (
                            <p style={{
                              fontSize: 12,
                              color: "var(--ink-soft)",
                              lineHeight: 1.6,
                              textAlign: "left",
                              margin: 0,
                            }}>
                              {c.fit_negatives.length > 120
                                ? c.fit_negatives.slice(0, 120) + "…"
                                : c.fit_negatives}
                            </p>
                          ) : "—"}
                        </DataCell>
                      ))}
                    </tr>
                  )}
                </>
              )}

              {/* ── Bottom CTA row ── */}
              <tr>
                <td style={{
                  padding: "16px",
                  background: "var(--bg-tint)",
                  borderRight: "1px solid var(--line)",
                }} />
                {companies.map((company) => (
                  <td
                    key={company.id}
                    style={{
                      padding: "14px 12px",
                      background: "var(--bg-tint)",
                      textAlign: "center",
                      borderRight: "1px solid var(--line-soft)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Link
                        href={`/companies/${company.id}`}
                        style={{
                          display: "block",
                          padding: "10px",
                          borderRadius: 9,
                          fontSize: 13,
                          fontWeight: 700,
                          background: "linear-gradient(135deg, #002366, #3B5FD9)",
                          color: "#fff",
                          textDecoration: "none",
                          textAlign: "center",
                        }}
                      >
                        詳細ページを見る
                      </Link>
                      {company.accepting_casual_meetings && (
                        <Link
                          href={`/companies/${company.id}/casual-meeting`}
                          style={{
                            display: "block",
                            padding: "10px",
                            borderRadius: 9,
                            fontSize: 13,
                            fontWeight: 700,
                            background: "linear-gradient(135deg, #F59E0B, #D97706)",
                            color: "#fff",
                            textDecoration: "none",
                            textAlign: "center",
                          }}
                        >
                          話を聞く
                        </Link>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Note ── */}
        <p style={{
          fontSize: 11,
          color: "var(--ink-mute)",
          textAlign: "center",
          marginTop: 20,
        }}>
          データはOPINIOが取材・収集した情報を元に構成されています。最新情報は各社の公式サイトでご確認ください。
        </p>
      </div>
    </>
  );
}
