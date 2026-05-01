import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Job, type PositionMember } from "@/app/jobs/mockJobData";
import { getJobById as fetchJobById } from "@/lib/supabase/queries";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await fetchJobById(params.id);
  if (!result) return { title: "求人 — Opinio" };
  const { job, company } = result;
  return {
    title: `${job.role} — ${company.name} — Opinio`,
    description: job.highlight,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SecTitle({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <span style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff",
      }}>
        {icon}
      </span>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
        {children}
      </h2>
    </div>
  );
}

function StatusBadge({ status, label }: { status: PositionMember["status"]; label: string }) {
  const styles = {
    current: { bg: "var(--success-soft)", color: "var(--success)", border: "#A7F3D0" },
    moved: { bg: "var(--warm-soft, #FEF3C7)", color: "var(--warm, #F59E0B)", border: "#FDE68A" },
    alumni: { bg: "var(--purple-soft, #F5F3FF)", color: "var(--purple)", border: "#E9D5FF" },
  };
  const s = styles[status];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const result = await fetchJobById(params.id);
  if (!result) notFound();

  const { job, company } = result;

  const initial = company.name.charAt(0).toUpperCase();
  const relatedJobs: Job[] = [];

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
            <span>/</span>
            <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>求人を探す</Link>
            <span>/</span>
            <span style={{ color: "var(--ink-soft)" }}>{job.role}</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "28px 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 14, flexShrink: 0,
              background: company.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 26, fontWeight: 700,
              boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            }}>
              {initial}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <Link href={`/companies/${company.id}`} style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600 }}>
                  {company.name}
                </Link>
                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {company.industry} · {company.employee_count.toLocaleString()}名
                </span>
              </div>

              <h1 style={{
                fontFamily: 'var(--font-noto-serif)',
                fontSize: "clamp(18px,2vw,24px)", fontWeight: 700,
                color: "var(--ink)", lineHeight: 1.4, marginBottom: 12,
                letterSpacing: "0.01em",
              }}>
                {job.role}
              </h1>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[job.employment_type, job.work_style, job.location, job.experience].map((b) => (
                  <span key={b} style={{
                    display: "inline-flex", alignItems: "center",
                    fontSize: 11.5, fontWeight: 600, padding: "5px 11px",
                    background: "#fff", border: "1px solid var(--line)", borderRadius: 100,
                    color: "var(--ink)",
                  }}>
                    {b}
                  </span>
                ))}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 100,
                  background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  ¥{job.salary_min}-{job.salary_max}万
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          <div className="grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]">

            {/* ── Main column ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Overview */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <SecTitle color="var(--royal)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8"/>
                  </svg>
                }>
                  ポジション概要
                </SecTitle>
                <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>{job.overview}</p>
              </section>

              {/* Main tasks */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <SecTitle color="#0891B2" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                }>
                  メイン業務
                </SecTitle>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {job.main_tasks.map((task, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                        background: "var(--royal-50)", color: "var(--royal)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, fontFamily: "Inter, sans-serif",
                      }}>
                        {i + 1}
                      </span>
                      {task}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Skills */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <SecTitle color="var(--gold)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                }>
                  必須スキル / 歓迎スキル
                </SecTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
                  <div style={{ padding: "16px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
                      fontSize: 11, fontWeight: 800, color: "#B45309", letterSpacing: "0.05em",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                      </svg>
                      必須スキル
                    </div>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                      {job.required_skills.map((s, i) => (
                        <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }}>
                            <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                          </svg>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ padding: "16px", borderRadius: 10, background: "var(--royal-50)", border: "1px solid var(--royal-100)" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
                      fontSize: 11, fontWeight: 800, color: "var(--royal)", letterSpacing: "0.05em",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      歓迎スキル
                    </div>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                      {job.preferred_skills.map((s, i) => (
                        <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }}>
                            <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                          </svg>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Benefits */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <SecTitle color="var(--success)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4M4 6v12c0 1.1.9 2 2 2h14v-4"/>
                    <circle cx="16" cy="14" r="2"/>
                  </svg>
                }>
                  待遇・福利厚生
                </SecTitle>
                <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
                  {job.benefits.map((row, i) => (
                    <div key={i} style={{
                      display: "grid", gridTemplateColumns: "120px 1fr",
                      borderBottom: i < job.benefits.length - 1 ? "1px solid var(--line-soft, #F1F5F9)" : "none",
                    }}>
                      <div style={{
                        padding: "11px 14px", fontSize: 12, fontWeight: 600,
                        color: "var(--ink-mute)", background: "var(--bg-tint)",
                        borderRight: "1px solid var(--line-soft, #F1F5F9)",
                      }}>
                        {row.key}
                      </div>
                      <div style={{ padding: "11px 14px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Selection flow */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <SecTitle color="var(--purple)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                }>
                  選考フロー
                </SecTitle>
                <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
                  {job.selection_flow.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "12px 14px",
                        background: i === 0 ? "var(--royal-50)" : i === job.selection_flow.length - 1 ? "var(--success-soft)" : "var(--bg-tint)",
                        border: `1px solid ${i === 0 ? "var(--royal-100)" : i === job.selection_flow.length - 1 ? "#A7F3D0" : "var(--line)"}`,
                        borderRadius: 10, minWidth: 88, textAlign: "center" as const,
                      }}>
                        <div style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 4,
                          color: i === 0 ? "var(--royal)" : i === job.selection_flow.length - 1 ? "var(--success)" : "var(--ink-mute)",
                        }}>
                          {step.step}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{step.name}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{step.meta}</div>
                      </div>
                      {i < job.selection_flow.length - 1 && (
                        <div style={{ padding: "0 6px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5}>
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p style={{
                  marginTop: 14, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7,
                  background: "var(--bg-tint)", padding: "10px 14px", borderRadius: 8,
                  borderLeft: "3px solid var(--royal-100)",
                }}>
                  {job.selection_note}
                </p>
              </section>

              {/* Position members */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: "var(--royal)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </span>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                      {company.name}でこの職種を経験した人
                      <span style={{ fontFamily: "Inter, sans-serif", color: "var(--royal)", marginLeft: 6 }}>
                        {job.position_members.length}名
                      </span>
                    </h2>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    うち <strong style={{ color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>
                      {job.position_members.filter((m) => m.is_mentor).length}
                    </strong> 名メンター登録
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7, marginBottom: 16 }}>
                  過去・現在に関わらず、{company.name}でこの職種を経験したOpinio登録者です。
                  <strong style={{ color: "var(--ink-soft)" }}>現在のステータス</strong>もあわせて表示しています。
                </p>

                {/* Avatar row */}
                <div style={{ display: "flex", marginBottom: 20 }}>
                  {job.position_members.map((m, i) => (
                    <div key={i} style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: m.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      border: "2.5px solid #fff",
                      marginLeft: i === 0 ? 0 : -10,
                      boxShadow: m.is_mentor ? "0 0 0 2px var(--royal), 0 0 0 4px #fff" : undefined,
                      position: "relative", zIndex: 10 - i,
                    }}>
                      {m.initial}
                    </div>
                  ))}
                </div>

                {/* Interview cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {job.position_members.map((m, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px",
                      background: "var(--bg-tint)", border: "1px solid var(--line)",
                      borderRadius: 10, cursor: "pointer",
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                        background: m.gradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 13, fontWeight: 700,
                        boxShadow: m.is_mentor ? "0 0 0 2px var(--royal), 0 0 0 4px #fff" : undefined,
                      }}>
                        {m.initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-noto-serif)',
                          fontSize: 13, fontWeight: 500, color: "var(--ink)",
                          lineHeight: 1.5, marginBottom: 4,
                        }}>
                          「{m.catch}」
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--ink-mute)" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <path d="M14 2v6h6"/>
                          </svg>
                          {m.name} · {m.period} · {m.date}
                        </div>
                      </div>
                      <StatusBadge status={m.status} label={m.status_label} />
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  ))}
                </div>

                {/* Status legend */}
                <div style={{
                  marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-soft)",
                  display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "var(--ink-mute)",
                }}>
                  {[
                    { dot: "var(--success)", label: "現役・現職継続" },
                    { dot: "#F59E0B", label: "現役・異動済み" },
                    { dot: "var(--purple)", label: "OBOG" },
                  ].map(({ dot, label }) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                      {label}
                    </span>
                  ))}
                  <span style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: "var(--royal)",
                      boxShadow: "0 0 0 1.5px var(--royal), 0 0 0 3px #fff",
                      flexShrink: 0,
                    }} />
                    メンター登録（相談可能）
                  </span>
                </div>
              </section>

              {/* Related article */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <SecTitle color="var(--ink)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8"/>
                  </svg>
                }>
                  関連する取材レポート
                </SecTitle>
                {(
                  <div style={{
                    display: "flex", gap: 14, padding: "14px 16px",
                    border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-tint)",
                  }}>
                    <div style={{
                      width: 80, height: 60, borderRadius: 8, flexShrink: 0,
                      background: company.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6, fontSize: 10,
                        color: "var(--ink-mute)", marginBottom: 5, fontWeight: 600,
                      }}>
                        <span style={{ padding: "2px 7px", borderRadius: 4, background: "var(--success-soft)", color: "var(--success)" }}>
                          編集部取材
                        </span>
                        {company.name}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, marginBottom: 4 }}>
                        {job.related_article_title}
                      </div>
                      <div style={{
                        fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      } as React.CSSProperties}>
                        {job.related_article_excerpt}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Company summary */}
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                <SecTitle color="var(--ink-mute)" icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  </svg>
                }>
                  企業について
                </SecTitle>
                <div style={{
                  display: "flex", gap: 16, alignItems: "flex-start",
                  padding: "16px", background: "var(--bg-tint)", borderRadius: 12,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                    background: company.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 20, fontWeight: 700,
                  }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 5,
                    }}>
                      {company.name}
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 100,
                        background: "var(--warm-soft)", color: "#B45309", fontWeight: 600,
                      }}>
                        {company.phase}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-noto-serif)',
                      fontSize: 12.5, color: "var(--royal)", lineHeight: 1.5, marginBottom: 10,
                    }}>
                      {company.tagline}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--ink-mute)", flexWrap: "wrap" }}>
                      <span>業種 <strong style={{ color: "var(--ink)" }}>{company.industry}</strong></span>
                      <span>従業員 <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{company.employee_count.toLocaleString()}</strong>名</span>
                    </div>
                  </div>
                  <Link
                    href={`/companies/${company.id}`}
                    style={{
                      alignSelf: "center", flexShrink: 0,
                      padding: "8px 14px", borderRadius: 8,
                      border: "1.5px solid var(--royal)", color: "var(--royal)",
                      fontSize: 12, fontWeight: 600, background: "#fff",
                    }}
                  >
                    企業ページへ
                  </Link>
                </div>
              </section>

              {/* Related jobs */}
              {relatedJobs.length > 0 && (
                <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px" }}>
                  <SecTitle color="var(--accent)" icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <rect x="2" y="7" width="20" height="14" rx="2"/>
                      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    </svg>
                  }>
                    {company.name}の他の求人
                  </SecTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                    {relatedJobs.map((rj) => (
                      <Link key={rj.id} href={`/jobs/${rj.id}`} style={{
                        display: "flex", gap: 12, alignItems: "flex-start",
                        padding: 14, border: "1px solid var(--line)", borderRadius: 10,
                        background: "var(--bg-tint)", textDecoration: "none",
                        transition: "border-color 0.2s, transform 0.2s",
                      }}
                        className="similar-job-card"
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: company.gradient,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 14, fontWeight: 700,
                        }}>
                          {initial}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 3 }}>
                            {rj.role}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                            ¥{rj.salary_min}-{rj.salary_max}万 · {rj.work_style}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside className="hidden lg:flex" style={{ flexDirection: "column", gap: 16, alignSelf: "flex-start", position: "sticky", top: 80 }}>
              {/* CTA */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "22px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  borderRadius: 10, padding: "18px", textAlign: "center" as const,
                }}>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginBottom: 6 }}>まずは気軽に話してみる</div>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 14, lineHeight: 1.4 }}>
                    {company.name}の<br />社員に相談する
                  </div>
                  <Link href={`/companies/${job.company_id}/casual-meeting?job_id=${job.id}`} style={{
                    display: "block", width: "100%", padding: "11px 0",
                    background: "#fff", color: "var(--royal)",
                    borderRadius: 8, fontSize: 13, fontWeight: 700,
                    textDecoration: "none", textAlign: "center",
                  }}>
                    カジュアル面談を申し込む
                  </Link>
                </div>
                <Link href={`/jobs/${job.id}/apply`} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: "100%", padding: "11px 0",
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
                  </svg>
                  正式に応募する
                </Link>
                <button style={{
                  width: "100%", padding: "11px 0",
                  background: "var(--bg-tint)", color: "var(--ink-soft)",
                  border: "1px solid var(--line)", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  気になるに追加
                </button>
              </div>

              {/* Job summary */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 14 }}>
                  求人サマリー
                </div>
                {[
                  { key: "職種", value: job.dept },
                  { key: "雇用形態", value: job.employment_type },
                  { key: "想定年収", value: `¥${job.salary_min}-${job.salary_max}万` },
                  { key: "勤務地", value: job.location },
                  { key: "働き方", value: job.work_style },
                  { key: "経験", value: job.experience },
                ].map(({ key, value }) => (
                  <div key={key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "8px 0", borderBottom: "1px solid var(--line-soft, #F1F5F9)", gap: 8,
                  }}>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>{key}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textAlign: "right" as const }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Mentor preview */}
              {job.position_members.some((m) => m.is_mentor) && (
                <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 12 }}>
                    メンター
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {job.position_members.filter((m) => m.is_mentor).map((m, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: "50%",
                          background: m.gradient,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 13, fontWeight: 700,
                          boxShadow: "0 0 0 2px var(--royal), 0 0 0 4px #fff",
                        }}>
                          {m.initial}
                        </div>
                        <span style={{ fontSize: 9, color: "var(--ink-mute)" }}>{m.name.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>
                    カジュアル面談でこの求人について相談できます。
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      <style>{`
        .similar-job-card:hover {
          border-color: var(--royal-100) !important;
          transform: translateY(-1px) !important;
        }
      `}</style>
    </>
  );
}
