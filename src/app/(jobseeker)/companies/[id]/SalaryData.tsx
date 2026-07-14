"use client";

import { useEffect, useState } from "react";
import { SALARY_MIN_REPORTS_TO_DISPLAY } from "@/lib/constants/salary";

interface SalaryReport {
  summary: { avg: number; min: number; max: number; count: number } | null;
  byRole: { roleId: string; roleName: string; count: number; avg: number }[];
}

interface Props {
  companyId: string;
}

function fmt(yen: number) {
  return `${Math.round(yen / 10000).toLocaleString()}万円`;
}

export default function SalaryDataSection({ companyId }: Props) {
  const [reports, setReports] = useState<SalaryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/salary-reports?company_id=${companyId}`)
      .then((r) => r.json())
      .then((d) => { setReports(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  // ローディング中は何も表示しない（レイアウトシフトを避けるため）
  if (loading) return null;

  // 3件未満（summary が null）はセクションごと非表示
  if (!reports?.summary) return null;

  const { summary, byRole } = reports;

  return (
    <section id="salary" style={{ marginBottom: "var(--space-8)" }}>
      <h2 style={{
        fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 20,
        fontFamily: "var(--font-noto-sans)", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color: "var(--success)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </span>
        給与データ
      </h2>

      <div style={{
        background: "var(--success-soft)",
        borderRadius: 14,
        padding: "20px 24px",
        border: "1px solid #A7F3D0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            background: "#D1FAE5", color: "#065F46", border: "1px solid #6EE7B7",
            padding: "2px 8px", borderRadius: 100, fontFamily: "Inter, sans-serif",
          }}>在籍者の実額</span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>会員の自己申告データ（匿名集計）</span>
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { label: "平均年収", value: fmt(summary.avg), highlight: true },
            { label: "最低", value: fmt(summary.min) },
            { label: "最高", value: fmt(summary.max) },
            { label: "件数", value: `${summary.count}件` },
          ].map(({ label, value, highlight }) => (
            <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "12px 18px", border: "1px solid #A7F3D0", minWidth: 90 }}>
              <div style={{ fontSize: 10, color: "#059669", fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: highlight ? 22 : 16, fontWeight: 800, color: highlight ? "var(--success)" : "var(--ink)", fontFamily: "Inter, sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>

        {byRole.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>職種別平均年収</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {byRole.map((r) => (
                <div key={r.roleId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 8, padding: "8px 14px", border: "1px solid #D1FAE5" }}>
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>{r.roleName}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{r.count}件</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--success)", fontFamily: "Inter, sans-serif" }}>{fmt(r.avg)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: "#065F46", marginTop: 12, lineHeight: 1.6 }}>
          ※ 会員の自己申告データを統計処理したものです。{SALARY_MIN_REPORTS_TO_DISPLAY}件未満のグループは非表示です。<br />
          ※ 利用規約第13条の4の範囲内でのみ使用されます。
        </p>
      </div>
    </section>
  );
}
