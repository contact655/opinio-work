"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SALARY_MIN_REPORTS_TO_DISPLAY } from "@/lib/constants/salary";

interface JobItem {
  id?: string;
  title: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  dept?: string | null;
  catchCopy?: string | null;
}

interface SalaryReport {
  summary: { avg: number; min: number; max: number; count: number } | null;
  byRole: { roleId: string; roleName: string; count: number; avg: number }[];
  insufficientData?: boolean;
}

interface Props {
  companyId: string;
  companyName: string;
  jobs: JobItem[];
}

function fmt(yen: number) {
  return `${Math.round(yen / 10000)}万円`;
}

function fmtRange(min?: number | null, max?: number | null) {
  if (min && max) return `${min}〜${max}万円`;
  if (min) return `${min}万円〜`;
  if (max) return `〜${max}万円`;
  return null;
}

export default function SalaryDataSection({ companyId, companyName, jobs }: Props) {
  const [reports, setReports] = useState<SalaryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/salary-reports?company_id=${companyId}`)
      .then((r) => r.json())
      .then((d) => { setReports(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  const jobsWithSalary = jobs.filter(
    (j) => (j.salaryMin && j.salaryMin > 0) || (j.salaryMax && j.salaryMax > 0)
  );

  const hasJobSalary = jobsWithSalary.length > 0;
  const hasSelfReported = !loading && reports?.summary != null;
  const hasInsufficientData = !loading && reports?.insufficientData;

  if (!hasJobSalary && !hasSelfReported && !hasInsufficientData && !loading) {
    return null;
  }

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

      {/* ── セクション1: 求人の提示レンジ（企業が掲示する建前） ─────────────────── */}
      {hasJobSalary && (
        <div style={{
          background: "var(--line-soft)",
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
              padding: "2px 8px", borderRadius: 100, fontFamily: "Inter, sans-serif",
            }}>求人の提示レンジ</span>
            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>企業が採用時に提示している想定年収</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {jobsWithSalary.map((job, idx) => {
              const range = fmtRange(job.salaryMin, job.salaryMax);
              return (
                <div key={job.id ?? idx} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#fff", borderRadius: 10, padding: "12px 16px",
                  border: "1px solid var(--line)",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{job.title}</div>
                    {job.dept && <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{job.dept}</div>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
                    {range}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 10, lineHeight: 1.6 }}>
            ※ 採用時の提示レンジです。実際の支給額とは異なる場合があります。
          </p>
        </div>
      )}

      {/* ── セクション2: 在籍者の自己申告（実態） ────────────────────────────── */}
      <div style={{
        background: hasSelfReported ? "var(--success-soft)" : "var(--line-soft)",
        borderRadius: 14,
        padding: "20px 24px",
        border: hasSelfReported ? "1px solid #A7F3D0" : "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            background: hasSelfReported ? "#D1FAE5" : "var(--line)",
            color: hasSelfReported ? "#065F46" : "var(--ink-mute)",
            border: `1px solid ${hasSelfReported ? "#6EE7B7" : "var(--line)"}`,
            padding: "2px 8px", borderRadius: 100, fontFamily: "Inter, sans-serif",
          }}>在籍者の実額</span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>会員の自己申告データ（匿名集計）</span>
        </div>

        {loading && (
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込み中...</div>
        )}

        {!loading && hasSelfReported && reports?.summary && (
          <>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                { label: "平均年収", value: fmt(reports.summary.avg), highlight: true },
                { label: "最低", value: fmt(reports.summary.min) },
                { label: "最高", value: fmt(reports.summary.max) },
                { label: "件数", value: `${reports.summary.count}件` },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "12px 18px", border: "1px solid #A7F3D0", minWidth: 90 }}>
                  <div style={{ fontSize: 10, color: "#059669", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: highlight ? 22 : 16, fontWeight: 800, color: highlight ? "var(--success)" : "var(--ink)", fontFamily: "Inter, sans-serif" }}>{value}</div>
                </div>
              ))}
            </div>

            {reports.byRole.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>職種別平均年収</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {reports.byRole.map((r) => (
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
          </>
        )}

        {!loading && hasInsufficientData && !hasSelfReported && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 8 }}>
              データがまだ少なく表示できません（{SALARY_MIN_REPORTS_TO_DISPLAY}件以上で表示）
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              あなたのデータが集計の助けになります
            </div>
          </div>
        )}

        {!loading && !hasSelfReported && !hasInsufficientData && (
          <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 4 }}>
              まだデータがありません
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              現役社員・OBOGのデータが集まると表示されます
            </div>
          </div>
        )}

        {/* CTA to submit */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #A7F3D0" }}>
          <Link
            href={`/mypage/salary/new?company_id=${companyId}&company_name=${encodeURIComponent(companyName)}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, color: "#065F46",
              background: "#fff", border: "1px solid #6EE7B7",
              padding: "7px 14px", borderRadius: 8, textDecoration: "none",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            この企業の給与データを投稿する
          </Link>
        </div>
      </div>
    </section>
  );
}
