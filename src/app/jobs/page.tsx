import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/common";
import { Footer } from "@/components/common";
import {
  MOCK_JOBS,
  filterJobs,
  type Job,
} from "./mockJobData";
import { MOCK_COMPANIES } from "../companies/mockCompanies";
import JobFilterBar from "./JobFilterBar";

export const metadata: Metadata = {
  title: "求人を見つける — Opinio",
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の最新求人情報。フルリモート・高年収・PdM・エンジニア求人を検索。",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function freshLabel(days: number): string {
  if (days === 0) return "今日更新";
  if (days === 1) return "昨日更新";
  if (days <= 7) return `${days}日前更新`;
  if (days <= 14) return "今週更新";
  if (days <= 21) return "先週更新";
  if (days <= 31) return "今月更新";
  return `${Math.floor(days / 7)}週間前更新`;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: Job }) {
  const company = MOCK_COMPANIES.find((c) => c.id === job.company_id);
  if (!company) return null;

  const initial = company.name.charAt(0).toUpperCase();
  const isFresh = job.updated_days_ago <= 7;
  const label = freshLabel(job.updated_days_ago);

  return (
    <Link
      href={`/jobs/${job.id}`}
      style={{
        display: "flex", flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 18px 16px",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      }}
      className="job-card-link"
    >
      {/* NEW ribbon */}
      {job.is_new && (
        <div style={{
          position: "absolute", top: 12, right: -28,
          transform: "rotate(45deg)",
          background: "var(--success)",
          color: "#fff", fontSize: 8, fontWeight: 800, letterSpacing: "0.12em",
          padding: "3px 32px", zIndex: 2,
        }}>
          NEW
        </div>
      )}

      {/* Head */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12, paddingRight: job.is_new ? 32 : 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: company.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 17, fontWeight: 700,
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--ink)",
            lineHeight: 1.4, marginBottom: 4,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {job.role}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--royal)", fontWeight: 600 }}>{company.name}</span>
            <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>·</span>
            {isFresh ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                background: "var(--success-soft)", color: "var(--success)",
                border: "1px solid #A7F3D0",
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} className="animate-blink-dot" />
                {label}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>{label}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {job.tags.map((tag) => (
          <span key={tag} style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 100,
            background: tag === "フルリモート" || tag === "全国どこでも" ? "var(--success-soft)" : "var(--bg-tint)",
            color: tag === "フルリモート" || tag === "全国どこでも" ? "var(--success)" : "var(--ink-soft)",
            border: `1px solid ${tag === "フルリモート" || tag === "全国どこでも" ? "#A7F3D0" : "var(--line)"}`,
            fontWeight: 500,
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Highlight */}
      <p style={{
        fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, flex: 1, marginBottom: 14,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {job.highlight}
      </p>

      {/* Footer */}
      <div style={{
        marginTop: "auto", paddingTop: 12,
        borderTop: "1px solid var(--line-soft, #F1F5F9)",
      }}>
        {/* Salary row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 1 }}>想定年収</div>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 700,
              color: "var(--royal)",
            }}>
              ¥{job.salary_min}-{job.salary_max}
              <span style={{ fontSize: 11, fontWeight: 400 }}>万</span>
            </div>
          </div>
          <span style={{
            fontSize: 12, color: "var(--royal)", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 3,
          }}>
            詳細を見る
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </div>

        {/* Members bar */}
        {job.dept_members > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 11, color: "var(--ink-mute)",
            background: "var(--bg-tint)", borderRadius: 8, padding: "7px 10px",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}>
              <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
            <span style={{ flex: 1, minWidth: 0 }}>
              {job.dept}職に
              <strong style={{ color: "var(--royal)", fontFamily: "Inter, sans-serif", margin: "0 3px" }}>{job.dept_members}</strong>
              名在籍中
            </span>
            <div style={{ display: "flex", alignItems: "center" }}>
              {job.member_avatars.slice(0, 3).map((av, i) => (
                <div key={i} style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: av.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 9, fontWeight: 700,
                  border: "2px solid #fff",
                  marginLeft: i === 0 ? 0 : -6,
                  zIndex: 3 - i,
                  position: "relative",
                }}>
                  {av.initial}
                </div>
              ))}
              {job.dept_members > 3 && (
                <span style={{
                  fontSize: 9, color: "var(--ink-mute)", marginLeft: 4, fontFamily: "Inter, sans-serif", fontWeight: 600,
                }}>
                  +{job.dept_members - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = { [key: string]: string | string[] | undefined };

export default function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = {
    dept:       typeof searchParams.dept       === "string" ? searchParams.dept       : undefined,
    salary:     typeof searchParams.salary     === "string" ? searchParams.salary     : undefined,
    work_style: typeof searchParams.work_style === "string" ? searchParams.work_style : undefined,
    location:   typeof searchParams.location   === "string" ? searchParams.location   : undefined,
    industry:   typeof searchParams.industry   === "string" ? searchParams.industry   : undefined,
    sort:       typeof searchParams.sort       === "string" ? searchParams.sort       : undefined,
  };

  const jobs = filterJobs(MOCK_JOBS, params);
  const newThisWeek = MOCK_JOBS.filter((j) => j.updated_days_ago <= 7).length;

  return (
    <>
      <Header />

      {/* Page top */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 py-6 md:px-12">
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
              <h1 style={{
                fontFamily: '"Noto Serif JP", serif',
                fontSize: "clamp(22px,2.5vw,28px)", fontWeight: 500,
                color: "var(--ink)", letterSpacing: "0.02em",
              }}>
                求人を、見つける。
              </h1>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--ink-mute)" }}>
                <strong style={{ color: "var(--royal)", fontSize: 18, fontWeight: 700 }}>{MOCK_JOBS.length.toLocaleString()}</strong>件
              </span>
            </div>

            {/* Freshness stats */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-mute)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                今週新着 <strong style={{ color: "var(--ink)" }}>{newThisWeek}件</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-mute)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                取材済企業 <strong style={{ color: "var(--ink)" }}>12社</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <Suspense fallback={<div style={{ height: 54, background: "#fff", borderBottom: "1px solid var(--line)" }} />}>
        <JobFilterBar total={jobs.length} />
      </Suspense>

      {/* Grid */}
      <main style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          {jobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--ink-soft)" }}>
                条件に合う求人が見つかりませんでした
              </p>
              <p style={{ fontSize: 14 }}>フィルターを変更してみてください</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <style>{`
        .job-card-link:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 12px 32px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
        .job-card-link:focus-visible {
          outline: 2px solid var(--royal);
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
