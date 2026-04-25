"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatSalaryRange } from "@/lib/utils/formatSalary";
import { getMatchReason } from "@/lib/utils/matchReason";
import { getJobCategoryStyle } from "@/lib/utils/jobCategoryStyle";
import { ApplyForm } from "@/components/jobs/ApplyForm";
import { getCompanyLogoUrl } from "@/lib/utils/companyLogo";

// ─── Types ───────────────────────────────────────────
type Props = {
  job: any;
  company: any;
  matchScore: any;
  isFavorited: boolean;
  isLoggedIn: boolean;
  mustReqs: any[];
  wantReqs: any[];
  similarJobs: any[];
  sameCompanyJobs: any[];
  sameCategoryJobs?: any[];
  sameSalaryJobs?: any[];
  jobMembers: any[];
};

// ─── Helpers ─────────────────────────────────────────

function getLogoUrl(company: any): string | null {
  return getCompanyLogoUrl(company);
}

function workStyleLabel(ws: string | null): string {
  if (!ws) return "";
  if (ws.includes("フル") && ws.includes("リモート")) return "フルリモート";
  if (ws.includes("リモート")) return "リモート中心";
  if (ws === "remote") return "フルリモート";
  if (ws === "hybrid" || ws.includes("ハイブリッド")) return "ハイブリッド";
  if (ws === "office" || ws.includes("オフィス")) return "オフィス出社";
  return ws;
}

// ─── Logo Component ──────────────────────────────────

function CompanyLogo({ company, size = 48 }: { company: any; size?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const logoUrl = getLogoUrl(company);

  if (failed || !logoUrl) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: 12,
          backgroundColor: "#f3f4f6", color: "#6b7280",
          fontSize: size * 0.35, fontWeight: 500,
          border: "0.5px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        {company?.name?.[0] ?? "?"}
      </div>
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: 12,
        border: "1px solid #e5e7eb", background: loaded ? "#fff" : "#f3f4f6",
        padding: loaded ? 6 : 0, overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain", display: loaded ? "block" : "none" }}
        onLoad={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.naturalWidth === 0) { setFailed(true); } else { setLoaded(true); }
        }}
        onError={() => setFailed(true)}
      />
      {!loaded && (
        <span style={{ fontSize: size * 0.35, fontWeight: 500, color: "#6b7280" }}>{company?.name?.[0] ?? "?"}</span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────

export default function JobDetailClient({
  job,
  company,
  matchScore,
  isFavorited: initialFavorited,
  isLoggedIn,
  mustReqs,
  wantReqs,
  // similarJobs is kept for backward compat but no longer used (see tabs)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  similarJobs,
  sameCompanyJobs,
  sameCategoryJobs = [],
  sameSalaryJobs = [],
  jobMembers,
}: Props) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favLoading, setFavLoading] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  // Related jobs tab: "category" | "salary" | "company"
  const [relatedTab, setRelatedTab] = useState<"category" | "salary" | "company">(() => {
    // Default: whichever has data, prioritizing category
    if (sameCategoryJobs.length > 0) return "category";
    if (sameSalaryJobs.length > 0) return "salary";
    return "company";
  });

  const salaryDisplay = formatSalaryRange(job.salary_min, job.salary_max);
  const score = matchScore?.overall_score ?? null;
  const matchReason =
    matchScore?.match_reasons?.[0] ?? getMatchReason(job, score ?? 70);

  const createdDate = job.created_at
    ? new Date(job.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : null;

  // ─── Favorite Toggle ────────────────────────────────
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (favLoading) return;
    if (!isLoggedIn) { router.push("/auth/login"); return; }
    setFavLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (favorited) {
      await supabase.from("ow_favorites").delete().eq("user_id", user.id).eq("target_type", "job").eq("target_id", job.id);
    } else {
      await supabase.from("ow_favorites").insert({ user_id: user.id, target_type: "job", target_id: job.id });
    }
    setFavorited(!favorited);
    setFavLoading(false);
  };

  return (
    <>
      {/* ═══ 1. Hero Area (unified, compact) ═══ */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb" }}>
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8" style={{ padding: "20px 0 20px" }}>
          <div className="px-4 sm:px-6 lg:px-0">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2" style={{ fontSize: 12, marginBottom: 10 }}>
              <Link href="/jobs" style={{ color: "#1a6fd4", textDecoration: "none" }}>求人一覧</Link>
              <span style={{ color: "#d1d5db" }}>›</span>
              <span style={{ color: "#6b7280" }} className="truncate max-w-[300px]">{job.title}</span>
            </nav>

            {/* Company name link */}
            {company && (
              <Link
                href={`/companies/${company.id}`}
                style={{ fontSize: 13, color: "#6b7280", textDecoration: "none", display: "inline-block", marginBottom: 4 }}
              >
                {company.name}
              </Link>
            )}

            {/* Title + Favorite */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, color: "#0f172a", lineHeight: 1.35, margin: 0, flex: 1 }}>
                {job.title}
              </h1>
              <button
                onClick={toggleFavorite}
                disabled={favLoading}
                style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                  background: favorited ? "#FCEBEB" : "transparent",
                  border: `1.5px solid ${favorited ? "#F09595" : "#e5e7eb"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title={favorited ? "気になるを解除" : "気になる"}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill={favorited ? "#E24B4A" : "none"} stroke={favorited ? "#E24B4A" : "#9ca3af"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 13.5S2 9.5 2 5.5C2 3.5 3.5 2 5.5 2c1 0 2 .5 2.5 1.5C8.5 2.5 9.5 2 10.5 2 12.5 2 14 3.5 14 5.5c0 4-6 8-6 8z" />
                </svg>
              </button>
            </div>

            {/* Primary job info row: Salary + Location + Overtime */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>年収</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>{salaryDisplay}</span>
              </div>
              {job.location && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>勤務地</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{job.location}</span>
                </div>
              )}
              {job.avg_overtime && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>平均残業</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{job.avg_overtime}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {job.job_category && (
                <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 12px", borderRadius: 999, ...getJobCategoryStyle(job.job_category) }}>
                  {job.job_category}
                </span>
              )}
              {job.work_style && (
                <span style={{ fontSize: 12, fontWeight: 500, color: "#059669", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 12px", borderRadius: 999 }}>
                  {workStyleLabel(job.work_style)}
                </span>
              )}
              {job.employment_type && (
                <span style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e7eb", padding: "3px 12px", borderRadius: 999 }}>
                  {job.employment_type}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3. Opinioの見解 (full-width, promoted below first view) ═══ */}
      {(job.fit_positives?.length > 0 || job.fit_negatives?.length > 0 || job.positives?.length > 0 || job.negatives?.length > 0 || job.agent_comment) && (
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 24 }}>
          <div style={{ background: "#fafaf7", borderRadius: 16, padding: 24, border: "1.5px solid #e8e4dc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#0f172a", padding: "3px 10px", borderRadius: 6 }}>Opinio</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>この求人の見解</span>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px 0" }}>現役社員・OBの声をもとにしたAI分析</p>

            {job.agent_comment && (
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 16 }}>{job.agent_comment}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* フィットしやすい点 */}
              {(job.fit_positives?.length > 0 || job.positives?.length > 0) && (
                <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 16, borderLeft: "3px solid #10b981" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d", marginBottom: 10 }}>フィットしやすい点</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(job.fit_positives || job.positives || []).slice(0, 3).map((item: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", flexShrink: 0, marginTop: 6 }} />
                        <span style={{ fontSize: 13, color: "#14532d", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 注意点 */}
              <div style={{ background: "#fffbeb", borderRadius: 10, padding: 16, borderLeft: "3px solid #f59e0b" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>注意点</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {((job.fit_negatives || job.negatives || []).length > 0
                    ? (job.fit_negatives || job.negatives || [])
                    : ["詳細な職場環境情報を収集中です", "メンターへの相談をおすすめします"]
                  ).slice(0, 3).map((item: string, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24", flexShrink: 0, marginTop: 6 }} />
                      <span style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 4. Two-Column Content ═══ */}
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

          {/* ─── Left Column (Main) ─── */}
          <div className="flex-1 min-w-0" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Mobile-only inline apply form (shown when user tapped mobile CTA) */}
            {showApplyForm && (
              <div className="lg:hidden" style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <ApplyForm
                  jobId={job.id}
                  jobTitle={job.title}
                  companyName={company?.name ?? ""}
                />
              </div>
            )}

            {/* Card: 一緒に働くメンバー */}
            {jobMembers && jobMembers.length > 0 && (
              <div style={{ background: "#fafaf7", borderRadius: 16, padding: 24, border: "1.5px solid #e8e4dc", marginBottom: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
                  一緒に働くメンバー
                </h3>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 16, margin: "0 0 16px 0" }}>
                  実際にこのポジションで働くメンバーです
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {jobMembers.map((jm: any) => {
                    const member = jm.member;
                    if (!member) return null;
                    return (
                      <div key={member.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        {member.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.photo_url}
                            alt=""
                            style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: 52, height: 52, borderRadius: "50%",
                            background: "#e8e4dc", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, fontWeight: 500, color: "#666", flexShrink: 0,
                          }}>
                            {member.name?.[0] ?? "?"}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>
                            {member.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                            {member.role}
                          </div>
                          {member.job_types && member.job_types.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                              {member.job_types.map((type: string, i: number) => (
                                <span key={i} style={{
                                  fontSize: 11,
                                  background: "#f0faf4",
                                  color: "#2d7a4f",
                                  border: "0.5px solid #b7e4c7",
                                  borderRadius: 99,
                                  padding: "2px 8px",
                                }}>
                                  {type}
                                </span>
                              ))}
                            </div>
                          )}
                          {member.background && (
                            <div style={{
                              fontSize: 12, color: "#888", lineHeight: 1.7,
                              background: "#fff", border: "0.5px solid #e8e4dc",
                              borderRadius: 8, padding: "8px 12px",
                            }}>
                              {member.background}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card: 仕事内容 */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", borderLeft: "3px solid #059669", paddingLeft: 12, marginBottom: 16 }}>
                仕事内容
              </h2>
              {job.description ? (
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>
                  {job.description}
                </p>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>詳細はメンターに直接確認できます。</p>
                  <Link href="/career-consultation" style={{ fontSize: 13, color: "#1a6fd4", textDecoration: "none", fontWeight: 500 }}>メンターに聞く →</Link>
                </div>
              )}
            </div>

            {/* Card: 募集背景（常に表示） */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", borderLeft: "3px solid #2d7a4f", borderRadius: 0, paddingLeft: 12, marginBottom: 16 }}>
                募集背景
              </h2>
              {job.appeal ? (
                <p style={{ fontSize: 14, lineHeight: 1.8, color: "#333", whiteSpace: "pre-wrap", margin: 0 }}>
                  {job.appeal}
                </p>
              ) : (
                <p style={{ fontSize: 14, color: "#aaa", margin: 0 }}>準備中です</p>
              )}
            </div>

            {/* Card: 求める人物像 */}
            {(job.requirements || job.preferred || mustReqs.length > 0 || wantReqs.length > 0) && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", borderLeft: "3px solid #059669", paddingLeft: 12, marginBottom: 16 }}>
                  求める人物像
                </h2>

                {/* 必須 */}
                {(job.requirements || mustReqs.length > 0) && (
                  <div style={{ marginBottom: 24 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
                      background: "#dc2626", color: "#fff",
                      padding: "4px 12px", borderRadius: 6,
                      display: "inline-flex", alignItems: "center", gap: 4,
                      marginBottom: 12,
                      boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                    }}>
                      <span style={{ fontSize: 10 }}>●</span>
                      必須
                    </span>
                    {job.requirements ? (
                      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{job.requirements}</div>
                    ) : (
                      <ul style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
                        {mustReqs.map((r: any) => (
                          <li key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#374151" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", flexShrink: 0, marginTop: 7 }} />
                            {r.content}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* 歓迎 */}
                {(job.preferred || wantReqs.length > 0) && (
                  <div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
                      background: "#1d4ed8", color: "#fff",
                      padding: "4px 12px", borderRadius: 6,
                      display: "inline-flex", alignItems: "center", gap: 4,
                      marginBottom: 12,
                      boxShadow: "0 1px 2px rgba(29, 78, 216, 0.2)",
                    }}>
                      <span style={{ fontSize: 10 }}>○</span>
                      歓迎
                    </span>
                    {job.preferred ? (
                      <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{job.preferred}</div>
                    ) : (
                      <ul style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
                        {wantReqs.map((r: any) => (
                          <li key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#6b7280" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#93c5fd", flexShrink: 0, marginTop: 7 }} />
                            {r.content}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Card: 勤務条件（常に表示） */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", borderLeft: "3px solid #2d7a4f", borderRadius: 0, paddingLeft: 12, marginBottom: 16 }}>
                勤務条件
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    { label: "勤務時間", value: job.work_hours },
                    { label: "平均残業", value: job.avg_overtime },
                    { label: "休日・休暇", value: job.holidays },
                    { label: "試用期間", value: job.trial_period },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "0.5px solid #eee" }}>
                      <td style={{ width: "30%", padding: "10px 0", fontSize: 13, color: "#888", verticalAlign: "top" }}>
                        {row.label}
                      </td>
                      <td style={{ padding: "10px 0", fontSize: 14, color: row.value ? "#333" : "#bbb", lineHeight: 1.7 }}>
                        {row.value ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card: 福利厚生（常に表示） */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", borderLeft: "3px solid #2d7a4f", borderRadius: 0, paddingLeft: 12, marginBottom: 16 }}>
                福利厚生
              </h2>
              {job.benefits ? (
                <p style={{ fontSize: 14, lineHeight: 1.8, color: "#333", whiteSpace: "pre-wrap", margin: 0 }}>
                  {job.benefits}
                </p>
              ) : (
                <p style={{ fontSize: 14, color: "#bbb", margin: 0 }}>—</p>
              )}
            </div>

            {/* Card: 選考フロー（常に表示） */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", borderLeft: "3px solid #2d7a4f", borderRadius: 0, paddingLeft: 12, marginBottom: 16 }}>
                選考フロー
              </h2>
              {job.selection_flow && job.selection_flow.length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  {job.selection_flow.map((step: string, i: number) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        background: "#f0faf4", border: "1px solid #b7e4c7",
                        borderRadius: 999, padding: "6px 16px",
                        fontSize: 13, color: "#2d7a4f", fontWeight: 500,
                      }}>
                        {step}
                      </span>
                      {i < job.selection_flow.length - 1 && (
                        <span style={{ color: "#ccc", fontSize: 16 }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: "#bbb", margin: 0 }}>—</p>
              )}
            </div>

          </div>

          {/* ─── Right Column (Sidebar) ─── */}
          <aside className="hidden lg:block" style={{ width: 300, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 80 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Sidebar Card 1: 企業情報サマリ */}
              {company && (
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                    <CompanyLogo company={company} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {[company.industry, company.phase].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  {/* Info grid */}
                  <div style={{ borderTop: "0.5px solid #e5e7eb" }}>
                    {[
                      company.industry && { label: "業界", value: company.industry },
                      company.phase && { label: "フェーズ", value: company.phase },
                      company.employee_count && { label: "社員数", value: `${company.employee_count}名` },
                    ].filter(Boolean).map((item: any) => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #f3f4f6" }}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{item.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href={`/companies/${company.id}`}
                    style={{ display: "block", textAlign: "center", fontSize: 13, fontWeight: 500, color: "#1a6fd4", textDecoration: "none", marginTop: 14 }}
                  >
                    企業詳細を見る →
                  </Link>
                </div>
              )}

              {/* Sidebar Card 2: 応募CTA */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {!showApplyForm ? (
                  <>
                    <button
                      onClick={() => {
                        if (!isLoggedIn) { router.push("/auth/signup"); return; }
                        setShowApplyForm(true);
                      }}
                      style={{ width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 500, color: "#fff", background: "#1a9e75", border: "none", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#0F6E56"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#1a9e75"; }}
                    >
                      この求人に応募する
                    </button>
                    <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", margin: "8px 0 4px" }}>
                      応募を迷っている場合は
                    </p>
                    <Link
                      href="/career-consultation"
                      style={{ display: "block", fontSize: 13, color: "#1a9e75", textAlign: "center", textDecoration: "none" }}
                    >
                      メンターに無料相談する
                    </Link>
                    {/* マッチ度：応募ボタンの下に控えめに表示 */}
                    {score !== null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 12px", background: "#F9FAF7", border: "0.5px solid #e8e4dc", borderRadius: 8 }}>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#1D9E75" }}>{score}%</div>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "#0F6E56" }}>マッチ度</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>{matchReason}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <ApplyForm
                    jobId={job.id}
                    jobTitle={job.title}
                    companyName={company?.name ?? ""}
                  />
                )}
                {/* マッチ度未算出メッセージ */}
                {isLoggedIn && score === null && (
                  <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", paddingTop: 16, margin: 0, textAlign: "center", borderTop: "0.5px solid #f3f4f6", marginTop: 16 }}>
                    プロフィールを入力するとマッチ度が表示されます
                  </p>
                )}
              </div>

              {/* Sidebar Card 3: 関連求人（3タブ切替） */}
              {(sameCategoryJobs.length > 0 || sameSalaryJobs.length > 0 || sameCompanyJobs.length > 0) && (
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                    関連する求人
                  </h3>

                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "0.5px solid #e5e7eb" }}>
                    {([
                      { key: "category" as const, label: "同職種", count: sameCategoryJobs.length, disabled: sameCategoryJobs.length === 0 },
                      { key: "salary" as const, label: "同年収帯", count: sameSalaryJobs.length, disabled: sameSalaryJobs.length === 0 },
                      { key: "company" as const, label: "同企業", count: sameCompanyJobs.length, disabled: sameCompanyJobs.length === 0 },
                    ]).map((tab) => {
                      const isActive = relatedTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => !tab.disabled && setRelatedTab(tab.key)}
                          disabled={tab.disabled}
                          style={{
                            flex: 1,
                            padding: "8px 4px",
                            fontSize: 12,
                            fontWeight: isActive ? 700 : 500,
                            color: tab.disabled ? "#d1d5db" : isActive ? "#1a9e75" : "#6b7280",
                            background: "transparent",
                            border: "none",
                            borderBottom: isActive ? "2px solid #1a9e75" : "2px solid transparent",
                            cursor: tab.disabled ? "not-allowed" : "pointer",
                            transition: "all 0.15s",
                            marginBottom: -0.5,
                          }}
                        >
                          {tab.label}
                          {!tab.disabled && (
                            <span style={{ fontSize: 10, marginLeft: 4, color: isActive ? "#1a9e75" : "#9ca3af" }}>
                              ({tab.count})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab content */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(() => {
                      const currentList =
                        relatedTab === "category" ? sameCategoryJobs :
                        relatedTab === "salary" ? sameSalaryJobs :
                        sameCompanyJobs;
                      const displayList = currentList.slice(0, 3);

                      if (displayList.length === 0) {
                        return (
                          <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "16px 0", margin: 0 }}>
                            該当する求人がありません
                          </p>
                        );
                      }

                      return displayList.map((sj: any) => {
                        const sjCompany = sj.ow_companies as any;
                        const sjSalary = formatSalaryRange(sj.salary_min, sj.salary_max);
                        // For "company" tab, don't re-show company name (we already know)
                        const showCompany = relatedTab !== "company";
                        return (
                          <Link
                            key={sj.id}
                            href={`/jobs/${sj.id}`}
                            style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 8, border: "0.5px solid #e5e7eb", textDecoration: "none", background: "#f9fafb" }}
                          >
                            {showCompany && sjCompany && <CompanyLogo company={sjCompany} size={32} />}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                                {sj.title}
                              </div>
                              {showCompany && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>{sjCompany?.name}</div>
                              )}
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                                {sj.job_category && relatedTab !== "category" && (
                                  <span style={{ fontSize: 11, color: "#6b7280" }}>{sj.job_category}</span>
                                )}
                                <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{sjSalary}</span>
                              </div>
                            </div>
                          </Link>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* 掲載日 */}
              {createdDate && (
                <p style={{ fontSize: 11, color: "#aaa", marginTop: 8, textAlign: "center" }}>
                  掲載日：{createdDate}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ═══ Mobile Fixed Bottom CTA (hidden when apply form is open) ═══ */}
      {!showApplyForm && (
      <div
        className="lg:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderTop: "1px solid #e5e7eb",
          padding: "12px 16px",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {score !== null && (
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{score}%</div>
            <div style={{ fontSize: 9, color: "#0F6E56", fontWeight: 600 }}>マッチ度</div>
          </div>
        )}
        <button
          onClick={() => {
            if (!isLoggedIn) { router.push("/auth/signup"); return; }
            setShowApplyForm(true);
            // Scroll to the inline form after it renders
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }, 50);
          }}
          style={{
            flex: 1,
            padding: "12px 0",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            background: "#1a9e75",
            border: "none",
            cursor: "pointer",
          }}
        >
          この求人に応募する
        </button>
      </div>
      )}
    </>
  );
}
