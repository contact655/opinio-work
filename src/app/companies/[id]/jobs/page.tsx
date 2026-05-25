import { createClient } from "@/lib/supabase/server";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import Link from "next/link";
import { notFound } from "next/navigation";

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

// ─── Salary formatter ────────────────────────────────────────────────────────
function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `${Math.round(n / 10000)}`;
  if (min && max) return `${fmt(min)}〜${fmt(max)}万円`;
  if (min) return `${fmt(min)}万円〜`;
  if (max) return `〜${fmt(max)}万円`;
  return null;
}

// ─── Work-style icon & label ─────────────────────────────────────────────────
function WorkStyleBadge({ style }: { style: string | null }) {
  if (!style) return null;
  const isRemote =
    style.includes("リモート") ||
    style.includes("在宅") ||
    style.includes("テレワーク") ||
    style.includes("フルリモート");
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
        background: isRemote ? "#f0fdf4" : "var(--bg-tint)",
        color: isRemote ? "var(--success)" : "var(--ink-mute)",
        border: `1px solid ${isRemote ? "#A7F3D0" : "var(--line)"}`,
        fontWeight: 500,
      }}
    >
      {isRemote ? "🏠" : "🏢"} {style}
    </span>
  );
}

// ─── Category badge ──────────────────────────────────────────────────────────
function CatBadge({ cat }: { cat: string | null }) {
  if (!cat) return null;
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
        background: "var(--royal-50)",
        color: "var(--royal)",
        border: "1px solid var(--royal-100)",
        fontWeight: 600,
      }}
    >
      {cat}
    </span>
  );
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────
async function getCompanyWithJobs(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select(
      `id, name, logo_url, logo_gradient, logo_letter, industry, location, employee_count,
      ow_jobs(id, title, job_category, employment_type, salary_min, salary_max, location, work_style, status, published_at)`
    )
    .eq("id", id)
    .single();
  return data;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CompanyJobsPage({
  params,
}: {
  params: { id: string };
}) {
  const company = await getCompanyWithJobs(params.id);
  if (!company) return notFound();

  const jobs = ((company.ow_jobs as any[]) || [])
    .filter((j) => j.status === "published" || j.status === "active")
    .sort((a, b) => {
      // 新着順
      const da = a.published_at ? new Date(a.published_at).getTime() : 0;
      const db = b.published_at ? new Date(b.published_at).getTime() : 0;
      return db - da;
    });

  // 7日以内なら新着バッジ
  const isNew = (publishedAt: string | null) => {
    if (!publishedAt) return false;
    return Date.now() - new Date(publishedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  const gradient = company.logo_gradient || "linear-gradient(135deg,#002366,#3B5FD9)";
  const letter = company.logo_letter || (company.name ? company.name[0] : "?");

  return (
    <>
      <JobseekerHeader />
      <main style={{ minHeight: "100vh", background: "var(--bg-tint)", paddingTop: 64 }}>

        {/* ── Company banner ── */}
        <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 20px" }}>
            {/* Back link */}
            <Link
              href={`/companies/${company.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: "var(--ink-mute)",
                textDecoration: "none",
                marginBottom: 16,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              企業詳細に戻る
            </Link>

            {/* Company identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                  background: gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 22, fontWeight: 700,
                  fontFamily: "var(--font-noto-serif)",
                }}>
                  {letter}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: 20, fontWeight: 700,
                  color: "var(--ink)", margin: 0, lineHeight: 1.3,
                }}>
                  {company.name}の求人一覧
                </h1>
                <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                  {company.industry && (
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{company.industry}</span>
                  )}
                  {company.location && (
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>📍 {company.location}</span>
                  )}
                  {company.employee_count && (
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                      {String(company.employee_count).includes("名") ? company.employee_count : `${company.employee_count}名`}
                    </span>
                  )}
                </div>
              </div>
              <div style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 13, fontWeight: 700,
                color: "var(--royal)",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 8,
                padding: "6px 14px",
                flexShrink: 0,
              }}>
                {jobs.length}件募集中
              </div>
            </div>
          </div>
        </div>

        {/* ── Job list ── */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px" }}>
          {jobs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {jobs.map((job) => {
                const salary = formatSalary(job.salary_min, job.salary_max);
                const newJob = isNew(job.published_at);
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    style={{
                      display: "flex",
                      gap: 0,
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      cursor: "pointer",
                      background: "#fff",
                      textDecoration: "none",
                      overflow: "hidden",
                      transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s",
                    }}
                    className="company-job-card"
                  >
                    {/* Left accent bar */}
                    <div style={{ width: 4, flexShrink: 0, background: "var(--royal)", opacity: 0.5 }} />

                    {/* Content */}
                    <div style={{
                      flex: 1,
                      padding: "18px 22px",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title + new badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                          {newJob && (
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 4,
                              background: "var(--success-soft,#ECFDF5)", color: "var(--success)",
                              fontWeight: 700, border: "1px solid #A7F3D0",
                            }}>
                              新着
                            </span>
                          )}
                          <h2 style={{
                            fontSize: 15, fontWeight: 700,
                            color: "var(--ink)", margin: 0, lineHeight: 1.35,
                          }}>
                            {job.title}
                          </h2>
                        </div>

                        {/* Tags */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <CatBadge cat={job.job_category} />
                          <WorkStyleBadge style={job.work_style} />
                          {job.employment_type && (
                            <span style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 6,
                              background: "var(--bg-tint)", color: "var(--ink-mute)",
                              border: "1px solid var(--line)", fontWeight: 500,
                            }}>
                              {job.employment_type}
                            </span>
                          )}
                          {job.location && job.location !== company.location && (
                            <span style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 6,
                              background: "var(--bg-tint)", color: "var(--ink-mute)",
                              border: "1px solid var(--line)", fontWeight: 500,
                            }}>
                              📍 {job.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Salary + CTA */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                        {salary && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>年収</div>
                            <div style={{
                              fontFamily: "Inter, sans-serif",
                              fontSize: 15, fontWeight: 800,
                              color: "var(--success)",
                            }}>
                              {salary}
                            </div>
                          </div>
                        )}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "8px 16px", borderRadius: 9,
                          background: "var(--royal-50)", color: "var(--royal)",
                          border: "1px solid var(--royal-100)",
                          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                        }}>
                          詳細を見る
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* ── Empty state ── */
            <div style={{
              textAlign: "center",
              padding: "64px 24px",
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                現在募集中の求人はありません
              </p>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24 }}>
                カジュアル面談でまず話を聞いてみませんか？
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link
                  href={`/companies/${company.id}/casual-meeting`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 22px", borderRadius: 9,
                    background: "linear-gradient(135deg,#F59E0B,#D97706)",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  カジュアル面談を申し込む
                </Link>
                <Link
                  href={`/companies/${company.id}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 22px", borderRadius: 9,
                    background: "#fff", color: "var(--royal)",
                    border: "1.5px solid var(--royal)",
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}
                >
                  企業詳細に戻る
                </Link>
              </div>
            </div>
          )}
        </div>

        <style>{`
          .company-job-card:hover {
            border-color: var(--accent) !important;
            box-shadow: 0 4px 20px rgba(59,95,217,0.10);
            transform: translateY(-1px);
          }
        `}</style>
      </main>
      <JobseekerFooter />
    </>
  );
}
