import { createClient } from "@/lib/supabase/server";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { BookmarkButton } from "./BookmarkButton";

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

// ─── Salary formatter ────────────────────────────────────────────────────────
// salary_min/max are stored in 万円 units — do NOT divide by 10000
function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `${n}`;
  if (min && max) return `${fmt(min)}〜${fmt(max)}万円`;
  if (min) return `${fmt(min)}万円〜`;
  if (max) return `〜${fmt(max)}万円`;
  return null;
}

// ─── Work-style icon & label ─────────────────────────────────────────────────
const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート",
  remote: "リモート可",
  hybrid: "ハイブリッド",
  office: "出社",
  flex: "フレックス",
};

function WorkStyleBadge({ style }: { style: string | null }) {
  if (!style) return null;
  const label = WORK_STYLE_LABELS[style] ?? style;
  const isRemote =
    label.includes("リモート") ||
    label.includes("在宅") ||
    label.includes("テレワーク");
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
      {isRemote ? "🏠" : "🏢"} {label}
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

// ─── Urgency badge ───────────────────────────────────────────────────────────
function UrgencyBadge() {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 4,
        background: "#FFF7ED",
        color: "#C2410C",
        border: "1px solid #FED7AA",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      🔥 急募
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
      ow_jobs(id, title, job_category, employment_type, salary_min, salary_max, location, work_style, status, published_at, catch_copy, urgency, why_hire)`
    )
    .eq("id", id)
    .single();
  return data;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CompanyJobsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { category?: string };
}) {
  const company = await getCompanyWithJobs(params.id);
  if (!company) return notFound();

  const allJobs = ((company.ow_jobs as any[]) || [])
    .filter((j) => j.status === "published" || j.status === "active")
    .sort((a, b) => {
      // Urgency=hot first, then newest
      if (a.urgency === "hot" && b.urgency !== "hot") return -1;
      if (b.urgency === "hot" && a.urgency !== "hot") return 1;
      const da = a.published_at ? new Date(a.published_at).getTime() : 0;
      const db = b.published_at ? new Date(b.published_at).getTime() : 0;
      return db - da;
    });

  // Unique categories for filter pills
  const categories = Array.from(
    new Set(allJobs.map((j) => j.job_category).filter(Boolean))
  ) as string[];

  // Apply category filter
  const selectedCat = searchParams.category ?? "";
  const jobs = selectedCat
    ? allJobs.filter((j) => j.job_category === selectedCat)
    : allJobs;

  // Group by category
  const grouped: Record<string, typeof jobs> = {};
  for (const job of jobs) {
    const key = job.job_category || "その他";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(job);
  }

  const isNew = (publishedAt: string | null) => {
    if (!publishedAt) return false;
    return Date.now() - new Date(publishedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  const gradient = company.logo_gradient || "linear-gradient(135deg,var(--royal),#3B5FD9)";
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
                    <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <MapPin size={13} color="#6B7280" />{company.location}
                    </span>
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
                {allJobs.length}件募集中
              </div>
            </div>
          </div>
        </div>

        {/* ── Category filter pills ── */}
        {categories.length > 1 && (
          <div style={{
            background: "#fff",
            borderBottom: "1px solid var(--line)",
            overflowX: "auto",
          }}>
            <div style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: "12px 24px",
              display: "flex",
              gap: 6,
              flexWrap: "nowrap",
            }}>
              <Link
                href={`/companies/${company.id}/jobs`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "5px 14px",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                  border: `1.5px solid ${!selectedCat ? "var(--royal)" : "var(--line)"}`,
                  background: !selectedCat ? "var(--royal)" : "#fff",
                  color: !selectedCat ? "#fff" : "var(--ink-soft)",
                  transition: "all 0.15s",
                }}
              >
                すべて（{allJobs.length}）
              </Link>
              {categories.map((cat) => {
                const count = allJobs.filter((j) => j.job_category === cat).length;
                const active = selectedCat === cat;
                return (
                  <Link
                    key={cat}
                    href={`/companies/${company.id}/jobs?category=${encodeURIComponent(cat)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 14px",
                      borderRadius: 100,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
                      background: active ? "var(--royal)" : "#fff",
                      color: active ? "#fff" : "var(--ink-soft)",
                      transition: "all 0.15s",
                    }}
                  >
                    {cat}（{count}）
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Job list ── */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px" }}>
          {jobs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {Object.entries(grouped).map(([cat, catJobs]) => (
                <div key={cat}>
                  {/* ⑧ Category group header */}
                  {Object.keys(grouped).length > 1 && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 12,
                      paddingBottom: 10,
                      borderBottom: "2px solid var(--royal-100)",
                    }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--royal)",
                        background: "var(--royal-50)",
                        border: "1px solid var(--royal-100)",
                        borderRadius: 6,
                        padding: "3px 12px",
                      }}>
                        {cat}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
                        {catJobs.length}件
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {catJobs.map((job, idx) => {
                      const salary = formatSalary(job.salary_min, job.salary_max);
                      const newJob = isNew(job.published_at);
                      const isHot = job.urgency === "hot";
                      // ⑩ First job or hot job gets visual emphasis
                      const isFeatured = isHot || (idx === 0 && catJobs.length >= 2);

                      return (
                        <div
                          key={job.id}
                          style={{
                            position: "relative",
                            display: "flex",
                            gap: 0,
                            border: `1px solid ${isHot ? "#FED7AA" : isFeatured ? "var(--royal-100)" : "var(--line)"}`,
                            borderRadius: 14,
                            background: isHot
                              ? "linear-gradient(to right, #FFFBF0, #fff)"
                              : isFeatured
                              ? "linear-gradient(to right, #f8fbff, #fff)"
                              : "#fff",
                            overflow: "hidden",
                            transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s",
                          }}
                          className="company-job-card"
                        >
                          {/* Left accent bar */}
                          <div style={{
                            width: 4,
                            flexShrink: 0,
                            background: isHot
                              ? "linear-gradient(to bottom, #F59E0B, #FB923C)"
                              : "var(--royal)",
                            opacity: isFeatured ? 1 : 0.45,
                          }} />

                          {/* Content */}
                          <div style={{ flex: 1, padding: "18px 20px 16px", minWidth: 0 }}>
                            {/* Top row: badges + title + bookmark */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Badge row */}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                                  {isHot && <UrgencyBadge />}
                                  {newJob && !isHot && (
                                    <span style={{
                                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                      background: "var(--success-soft,#ECFDF5)", color: "var(--success)",
                                      fontWeight: 700, border: "1px solid #A7F3D0",
                                    }}>
                                      新着
                                    </span>
                                  )}
                                  {isFeatured && !isHot && (
                                    <span style={{
                                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                      background: "var(--royal-50)", color: "var(--royal)",
                                      fontWeight: 700, border: "1px solid var(--royal-100)",
                                    }}>
                                      注目
                                    </span>
                                  )}
                                </div>
                                {/* Title */}
                                <h2 style={{
                                  fontSize: 15, fontWeight: 700,
                                  color: "var(--ink)", margin: 0, lineHeight: 1.35,
                                }}>
                                  {job.title}
                                </h2>
                              </div>
                              {/* ③ Bookmark button */}
                              <BookmarkButton jobId={job.id} />
                            </div>

                            {/* ② Catch copy */}
                            {job.catch_copy && (
                              <p style={{
                                fontSize: 13,
                                color: "var(--ink-soft)",
                                margin: "0 0 10px",
                                lineHeight: 1.5,
                                fontStyle: "italic",
                                borderLeft: "3px solid var(--royal-100)",
                                paddingLeft: 10,
                              }}>
                                {job.catch_copy}
                              </p>
                            )}

                            {/* Tags row */}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
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
                                  display: "inline-flex", alignItems: "center", gap: 3,
                                }}>
                                  <MapPin size={10} color="#6B7280" />{job.location}
                                </span>
                              )}
                              {/* ⑨ why_hire hint tag */}
                              {job.why_hire && (
                                <span style={{
                                  fontSize: 11, padding: "2px 8px", borderRadius: 6,
                                  background: "var(--purple-soft,#F3E8FF)", color: "var(--purple,#7C3AED)",
                                  border: "1px solid #DDD6FE", fontWeight: 500,
                                  maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {(job.why_hire as string).slice(0, 20)}{(job.why_hire as string).length > 20 ? "…" : ""}
                                </span>
                              )}
                            </div>

                            {/* Bottom row: salary + CTAs */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              {salary && (
                                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginRight: 4 }}>
                                  <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600 }}>年収</span>
                                  <span style={{
                                    fontFamily: "Inter, sans-serif",
                                    fontSize: 16, fontWeight: 800,
                                    color: "var(--success)",
                                  }}>
                                    {salary}
                                  </span>
                                </div>
                              )}
                              <div style={{ flex: 1 }} />
                              {/* ④ Talk CTA */}
                              <Link
                                href={`/companies/${company.id}/casual-meeting`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "7px 14px", borderRadius: 8,
                                  background: "linear-gradient(135deg,#F59E0B,#FB923C)",
                                  color: "#fff",
                                  fontSize: 12, fontWeight: 700,
                                  textDecoration: "none",
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 2px 8px rgba(245,158,11,0.25)",
                                }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                                話を聞く（無料）
                              </Link>
                              {/* Detail CTA */}
                              <Link
                                href={`/jobs/${job.id}`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "7px 16px", borderRadius: 8,
                                  background: "var(--royal-50)", color: "var(--royal)",
                                  border: "1px solid var(--royal-100)",
                                  fontSize: 12, fontWeight: 700,
                                  textDecoration: "none",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                詳細を見る
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
                {selectedCat ? `「${selectedCat}」の求人は現在ありません` : "現在募集中の求人はありません"}
              </p>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24 }}>
                カジュアル面談でまず話を聞いてみませんか？
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {selectedCat && (
                  <Link
                    href={`/companies/${company.id}/jobs`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 22px", borderRadius: 9,
                      background: "var(--royal-50)", color: "var(--royal)",
                      border: "1.5px solid var(--royal-100)",
                      fontSize: 13, fontWeight: 700, textDecoration: "none",
                    }}
                  >
                    すべての求人を見る
                  </Link>
                )}
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
            box-shadow: 0 4px 20px rgba(59,95,217,0.10);
            transform: translateY(-1px);
          }
        `}</style>
      </main>
      <JobseekerFooter />
    </>
  );
}
