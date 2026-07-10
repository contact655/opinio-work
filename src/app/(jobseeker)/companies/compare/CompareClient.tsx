"use client";

import Link from "next/link";

type Company = {
  id: string;
  name: string;
  industry: string | null;
  phase: string | null;
  tagline: string | null;
  employee_count: number | null;
  avg_salary: string | null;
  avg_age: string | null;
  female_ratio: string | null;
  remote_work_status: string | null;
  flex_time: boolean | null;
  side_job_ok: boolean | null;
  accepting_casual_meetings: boolean | null;
  logo_gradient: string | null;
  logo_letter: string | null;
  logo_url: string | null;
  fit_positives: string[] | null;
  fit_negatives: string[] | null;
};

const WORK_LABELS: Record<string, string> = {
  remote: "フルリモート", full_remote: "フルリモート", フルリモート: "フルリモート",
  hybrid: "ハイブリッド", ハイブリッド: "ハイブリッド",
  on_site: "出社", 出社: "出社", オフィス勤務: "出社",
};

function WorkBadge({ status }: { status: string | null }) {
  const label = status ? (WORK_LABELS[status] ?? status) : "—";
  const color = label.includes("リモート") ? "var(--success)" : label === "ハイブリッド" ? "var(--royal)" : "var(--ink-soft)";
  return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{label}</span>;
}

function Check({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span style={{ color: "var(--ink-mute)" }}>—</span>;
  return ok
    ? <span style={{ color: "var(--success)", fontWeight: 700 }}>✓ あり</span>
    : <span style={{ color: "var(--ink-mute)" }}>なし</span>;
}

const ROWS: { label: string; render: (c: Company) => React.ReactNode }[] = [
  { label: "業種", render: (c) => c.industry ?? "—" },
  { label: "フェーズ", render: (c) => c.phase ?? "—" },
  { label: "従業員数", render: (c) => c.employee_count ? `${c.employee_count}名` : "—" },
  { label: "平均年収", render: (c) => c.avg_salary ? <span style={{ color: "var(--success)", fontWeight: 700 }}>{c.avg_salary}</span> : "—" },
  { label: "平均年齢", render: (c) => c.avg_age ?? "—" },
  { label: "女性比率", render: (c) => c.female_ratio ?? "—" },
  { label: "勤務形態", render: (c) => <WorkBadge status={c.remote_work_status} /> },
  { label: "フレックス", render: (c) => <Check ok={c.flex_time} /> },
  { label: "副業", render: (c) => <Check ok={c.side_job_ok} /> },
  { label: "カジュアル面談", render: (c) => <Check ok={c.accepting_casual_meetings} /> },
];

export default function CompareClient({ companies }: { companies: Company[] }) {
  const n = companies.length;
  const colWidth = n === 1 ? "100%" : n === 2 ? "50%" : "33.33%";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <Link href="/companies" style={{ fontSize: 13, color: "var(--royal)", textDecoration: "none" }}>← 企業一覧</Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }}>企業比較</h1>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{n}社</span>
      </div>

      {/* ヘッダー行 */}
      <div style={{ display: "flex", gap: 0, border: "1px solid var(--line)", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
        <div style={{ width: 140, flexShrink: 0, background: "var(--bg-tint)", borderRight: "1px solid var(--line)", padding: "20px 16px", fontWeight: 700, fontSize: 13, color: "var(--ink-soft)" }}>
          企業
        </div>
        {companies.map((c) => (
          <div key={c.id} style={{ width: colWidth, borderRight: "1px solid var(--line)", padding: "16px 14px", textAlign: "center", background: "#fff" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10, margin: "0 auto 10px",
              background: c.logo_gradient ?? "linear-gradient(135deg,#001233,#002366)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif",
              overflow: "hidden",
            }}>
              {c.logo_url
                ? <img src={c.logo_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (c.logo_letter ?? c.name[0])}
            </div>
            <Link href={`/companies/${c.id}`} style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", textDecoration: "none" }}>
              {c.name}
            </Link>
            {c.tagline && (
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.4 }}>{c.tagline}</div>
            )}
          </div>
        ))}
      </div>

      {/* データ行 */}
      {ROWS.map((row, i) => (
        <div key={row.label} style={{ display: "flex", borderLeft: "1px solid var(--line)", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: i % 2 === 0 ? "#fff" : "var(--bg-tint)" }}>
          <div style={{ width: 140, flexShrink: 0, borderRight: "1px solid var(--line)", padding: "12px 16px", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", display: "flex", alignItems: "center" }}>
            {row.label}
          </div>
          {companies.map((c) => (
            <div key={c.id} style={{ width: colWidth, borderRight: "1px solid var(--line)", padding: "12px 14px", fontSize: 13, color: "var(--ink)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {row.render(c)}
            </div>
          ))}
        </div>
      ))}

      {/* フィットする人 */}
      <div style={{ display: "flex", borderLeft: "1px solid var(--line)", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
        <div style={{ width: 140, flexShrink: 0, borderRight: "1px solid var(--line)", padding: "16px 16px", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", background: "var(--bg-tint)" }}>
          向いている人
        </div>
        {companies.map((c) => (
          <div key={c.id} style={{ width: colWidth, borderRight: "1px solid var(--line)", padding: "14px", background: "#fff" }}>
            {c.fit_positives?.slice(0, 3).map((p, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--ink)" }}>
                <span style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }}>✓</span>
                <span>{p}</span>
              </div>
            )) ?? <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>—</span>}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {companies.map((c) => (
          <Link key={c.id} href={`/companies/${c.id}`}
            style={{ padding: "10px 20px", borderRadius: 8, border: "1.5px solid var(--royal)", color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            {c.name} の詳細 →
          </Link>
        ))}
      </div>
    </div>
  );
}
