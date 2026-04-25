import Link from "next/link";
import type { JobPerformance } from "@/lib/business/dashboard";
import { INDUSTRY_AVG_CONVERSION_RATE } from "@/lib/business/dashboard";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "公開中",   color: "#15803d", bg: "#f0fdf4" },
  draft:     { label: "下書き",   color: "#6b7280", bg: "#f3f4f6" },
  closed:    { label: "終了",     color: "#9ca3af", bg: "#f9fafb" },
  paused:    { label: "停止中",   color: "#92400e", bg: "#fffbeb" },
};

export function JobPerformanceList({ jobs }: { jobs: JobPerformance[] }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>求人のパフォーマンス</h2>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>業界平均応募率: {INDUSTRY_AVG_CONVERSION_RATE}%</span>
      </div>

      {jobs.length === 0 ? (
        <div style={{
          background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8,
          padding: "32px 20px", textAlign: "center",
        }}>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>まだ求人が公開されていません</p>
          <Link
            href="/biz/jobs/new"
            style={{
              display: "inline-block", padding: "10px 20px", borderRadius: 8,
              fontSize: 13, fontWeight: 600, background: "#1D9E75", color: "#fff", textDecoration: "none",
            }}
          >
            求人を作成する →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j) => {
            const status = STATUS_LABELS[j.status || ""] || STATUS_LABELS.draft;
            return (
              <div
                key={j.job_id}
                style={{
                  background: "#fff",
                  border: `0.5px solid ${j.isUnderperforming ? "#fde68a" : "#e5e7eb"}`,
                  borderRadius: 8,
                  padding: 16,
                  display: "flex", alignItems: "center", gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Link
                      href={`/biz/jobs/${j.job_id}`}
                      style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
                    >
                      {j.title || "—"}
                    </Link>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                      background: status.bg, color: status.color,
                    }}>
                      {status.label}
                    </span>
                  </div>
                  {j.isUnderperforming && (
                    <div style={{
                      fontSize: 11, color: "#92400e", display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      応募率が業界平均({INDUSTRY_AVG_CONVERSION_RATE}%)を下回っています
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 22 }}>
                  <Stat label="閲覧" value={j.view_count} />
                  <Stat label="応募" value={j.application_count} />
                  <Stat
                    label="応募率"
                    value={`${j.conversion_rate_pct}%`}
                    valueColor={j.isUnderperforming ? "#dc2626" : "#0f172a"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, valueColor = "#0f172a" }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div style={{ textAlign: "right", minWidth: 64 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: valueColor, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{label}</div>
    </div>
  );
}
