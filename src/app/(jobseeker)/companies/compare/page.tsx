import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "企業を比較する — OPINIO",
  description: "選んだIT/SaaS企業をフェーズ・リモート・カジュアル面談などの軸で比較できます。",
};

type SearchParams = { ids?: string };

type CompareCompany = {
  id: string;
  name: string;
  industry: string | null;
  phase: string | null;
  employee_count: string | null;
  location: string | null;
  remote_work_status: string | null;
  accepting_casual_meetings: boolean | null;
  tagline: string | null;
  logo_letter: string | null;
  logo_gradient: string | null;
};

// ── Row definitions ──────────────────────────────────────────────────────────
type Row = {
  label: string;
  render: (c: CompareCompany) => React.ReactNode;
};

const ROWS: Row[] = [
  {
    label: "タグライン",
    render: (c) =>
      c.tagline ? (
        <span style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          {c.tagline}
        </span>
      ) : (
        <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
      ),
  },
  {
    label: "業種",
    render: (c) =>
      c.industry ? (
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: "2px 8px", borderRadius: 100,
          background: "var(--royal-50)", color: "var(--royal)",
          border: "1px solid var(--royal-100)",
        }}>
          {c.industry}
        </span>
      ) : (
        <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
      ),
  },
  {
    label: "フェーズ",
    render: (c) =>
      c.phase ? (
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: "2px 8px", borderRadius: 100,
          background: "#ede9fe", color: "#6b3b9e",
        }}>
          {c.phase}
        </span>
      ) : (
        <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
      ),
  },
  {
    label: "従業員数",
    render: (c) =>
      c.employee_count ? (
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{c.employee_count}</span>
      ) : (
        <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
      ),
  },
  {
    label: "所在地",
    render: (c) =>
      c.location ? (
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{c.location}</span>
      ) : (
        <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
      ),
  },
  {
    label: "リモートワーク",
    render: (c) =>
      c.remote_work_status ? (
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{c.remote_work_status}</span>
      ) : (
        <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
      ),
  },
  {
    label: "カジュアル面談",
    render: (c) =>
      c.accepting_casual_meetings ? (
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: "var(--success)",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          受付中
        </span>
      ) : (
        <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>
      ),
  },
];

// ── Logo avatar ──────────────────────────────────────────────────────────────
function CompanyAvatar({ company }: { company: CompareCompany }) {
  const initial = company.logo_letter ?? company.name.slice(0, 1);
  const bg = company.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)";
  return (
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 12,
      background: bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 22,
      fontWeight: 700,
      color: "rgba(255,255,255,0.85)",
      flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const rawIds = searchParams.ids ?? "";
  const ids = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  let companies: CompareCompany[] = [];

  if (ids.length > 0) {
    const supabase = createClient();
    const { data } = await supabase
      .from("ow_companies")
      .select(
        "id, name, industry, phase, employee_count, location, remote_work_status, accepting_casual_meetings, tagline, logo_letter, logo_gradient"
      )
      .in("id", ids);

    // preserve order of ids
    const byId = Object.fromEntries((data ?? []).map((c) => [c.id, c]));
    companies = ids.map((id) => byId[id]).filter(Boolean) as CompareCompany[];
  }

  const colCount = companies.length;

  return (
    <div style={{ background: "#f0f4f8", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px 0" }}>

        {/* Back link */}
        <Link
          href="/companies"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--ink-soft)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          企業一覧に戻る
        </Link>

        {/* Title */}
        <h1 style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: "clamp(20px, 3vw, 26px)",
          fontWeight: 700,
          color: "var(--ink)",
          marginBottom: 8,
        }}>
          企業を比較する
        </h1>

        {companies.length < 2 ? (
          <div style={{
            marginTop: 40,
            padding: 32,
            background: "#fff",
            borderRadius: 16,
            textAlign: "center",
            border: "1px solid var(--line)",
          }}>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 16 }}>
              比較するには企業を2〜3社選んでください。
            </p>
            <Link href="/companies" style={{
              display: "inline-flex",
              padding: "10px 20px",
              borderRadius: 8,
              background: "var(--royal)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}>
              企業一覧へ
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 24 }}>
            <table style={{
              width: "100%",
              minWidth: 480,
              borderCollapse: "collapse",
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              border: "1px solid var(--line)",
            }}>
              {/* Header row: company names */}
              <thead>
                <tr>
                  <th style={{
                    width: 130,
                    minWidth: 100,
                    padding: "16px 14px",
                    background: "var(--bg-tint)",
                    borderBottom: "1.5px solid var(--line)",
                    borderRight: "1px solid var(--line)",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}>
                    項目
                  </th>
                  {companies.map((c) => (
                    <th
                      key={c.id}
                      style={{
                        width: `${Math.floor(100 / colCount)}%`,
                        padding: "16px 14px",
                        background: "var(--bg-tint)",
                        borderBottom: "1.5px solid var(--line)",
                        borderRight: "1px solid var(--line)",
                        textAlign: "left",
                      }}
                    >
                      <Link href={`/companies/${c.id}`} style={{ textDecoration: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <CompanyAvatar company={c} />
                          <span style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--ink)",
                            lineHeight: 1.3,
                          }}>
                            {c.name}
                          </span>
                        </div>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Data rows */}
              <tbody>
                {ROWS.map((row, ri) => (
                  <tr
                    key={row.label}
                    style={{ background: ri % 2 === 0 ? "#fff" : "var(--bg-tint)" }}
                  >
                    <td style={{
                      padding: "14px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      borderRight: "1px solid var(--line)",
                      whiteSpace: "nowrap",
                      verticalAlign: "top",
                    }}>
                      {row.label}
                    </td>
                    {companies.map((c) => (
                      <td
                        key={c.id}
                        style={{
                          padding: "14px 14px",
                          borderRight: "1px solid var(--line)",
                          verticalAlign: "top",
                        }}
                      >
                        {row.render(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* Footer: CTA links */}
              <tfoot>
                <tr style={{ background: "var(--bg-tint)", borderTop: "1.5px solid var(--line)" }}>
                  <td style={{
                    padding: "14px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink-soft)",
                    borderRight: "1px solid var(--line)",
                  }}>
                    詳細
                  </td>
                  {companies.map((c) => (
                    <td
                      key={c.id}
                      style={{
                        padding: "14px 14px",
                        borderRight: "1px solid var(--line)",
                      }}
                    >
                      <Link
                        href={`/companies/${c.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "var(--royal)",
                          color: "#fff",
                          textDecoration: "none",
                        }}
                      >
                        企業ページを見る →
                      </Link>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
