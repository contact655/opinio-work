"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SALARY_MIN_REPORTS_TO_DISPLAY, SALARY_STATS_MIN } from "@/lib/constants/salary";

interface RawReport {
  roleName: string;
  salary: number | null;
  grade: string | null;
  startYM: string | null;
  endYM: string | null;
}

interface SalaryReport {
  summary: { avg: number; min: number; max: number; count: number } | null;
  byRole: { roleId: string; roleName: string; count: number; avg: number }[];
  insufficientData?: boolean;
  rawReports?: RawReport[];
}

interface Props {
  companyId: string;
  companyName: string;
}

function fmt(yen: number) {
  return `${Math.round(yen / 10000).toLocaleString()}万円`;
}

function fmtYM(ym: string | null): string | null {
  if (!ym) return null;
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
}

export default function SalaryDataSection({ companyId, companyName }: Props) {
  const [reports, setReports] = useState<SalaryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/salary-reports?company_id=${companyId}`)
      .then((r) => r.json())
      .then((d) => { setReports(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  const hasSelfReported = !loading && reports?.summary != null;
  const hasInsufficientData = !loading && reports?.insufficientData;
  const rawReports = reports?.rawReports ?? [];
  const hasRawReports = hasInsufficientData && rawReports.length > 0;
  const hasNoData = !loading && !hasSelfReported && !hasInsufficientData;

  if (!loading && !hasSelfReported && !hasInsufficientData && !hasNoData) {
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

      {/* ── 在籍者の自己申告（実態） ────────────────────────────── */}
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

        {/* 3件以上: 統計表示 */}
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

        {/* 1〜2件: 参考値として個別表示 */}
        {!loading && hasRawReports && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 10 }}>
              在籍者の自己申告データ（{rawReports.length}件）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {rawReports.map((r, i) => {
                const startFmt = fmtYM(r.startYM);
                const endFmt = fmtYM(r.endYM);
                const period = startFmt
                  ? endFmt ? `${startFmt} 〜 ${endFmt}` : `${startFmt} 〜 現在`
                  : null;
                return (
                  <div key={i} style={{
                    background: "#fff", borderRadius: 10, padding: "12px 16px",
                    border: "1px solid var(--line)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.roleName}</span>
                        {r.grade && (
                          <span style={{ fontSize: 10, color: "var(--ink-mute)", background: "var(--line-soft)", padding: "1px 6px", borderRadius: 6 }}>
                            {r.grade}
                          </span>
                        )}
                      </div>
                      {period && (
                        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{period}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif" }}>
                        {r.salary != null ? fmt(r.salary) : "—"}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                        background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A",
                        padding: "2px 6px", borderRadius: 6, fontFamily: "Inter, sans-serif",
                      }}>参考値</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>
              ※ データが{SALARY_STATS_MIN}件未満のため参考値として表示しています。統計的な信頼性は低い場合があります。<br />
              ※ 利用規約第13条の4の範囲内でのみ使用されます。
            </p>
          </>
        )}

        {/* 0件: 強い誘導 */}
        {!loading && hasNoData && (
          <div style={{ padding: "8px 0 4px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              この企業の給与データはまだありません。
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
              在籍・在籍経験のある方、最初の投稿をお願いします。<br />
              投稿いただいたデータは匿名で集計され、他の求職者の参考になります。
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${hasSelfReported ? "#A7F3D0" : "var(--line)"}` }}>
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
