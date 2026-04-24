import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/common";
import { Footer } from "@/components/common";
import CompanyFilterBar from "./CompanyFilterBar";
import {
  filterCompanies,
  formatUpdated,
  type Company,
} from "./mockCompanies";
import { getCompanies } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "IT/SaaS企業を知る — Opinio",
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界127社の最新求人・組織文化・カジュアル面談情報をまとめて確認。",
};

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: Company }) {
  const freshLabel = formatUpdated(company.updated_days_ago);
  const isFresh = company.updated_days_ago <= 7;
  const initial = company.name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/companies/${company.id}`}
      style={{
        display: "flex", flexDirection: "column",
        background: company.is_dimmed ? "var(--bg-tint)" : "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "22px 22px 20px",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
        opacity: company.is_dimmed ? 0.7 : 1,
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      }}
      className="company-card-link"
    >
      {/* Editor's Pick ribbon */}
      {company.is_editors_pick && (
        <div style={{
          position: "absolute", top: 14, right: -34,
          transform: "rotate(45deg)",
          background: "linear-gradient(135deg, var(--royal), var(--accent))",
          color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
          padding: "3px 40px", zIndex: 2,
        }}>
          PICK
        </div>
      )}

      {/* Accepting meetings badge */}
      {company.accepting_casual_meetings && (
        <div style={{
          position: "absolute", top: 18, right: 18,
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "var(--success-soft, #ECFDF5)", color: "var(--success)",
          fontSize: 10, fontWeight: 700,
          padding: "4px 10px", borderRadius: 100,
          border: "1px solid #A7F3D0", zIndex: 1,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--success)", flexShrink: 0,
          }} className="animate-blink-dot" />
          面談受付中
        </div>
      )}

      {/* Head: logo + name */}
      <div style={{
        display: "flex", gap: 12, alignItems: "flex-start",
        marginBottom: 14,
        paddingRight: company.accepting_casual_meetings ? 80 : 0,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: company.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 17, fontWeight: 700,
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
            {company.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
            {company.industry} · {company.employee_count.toLocaleString()}名
          </div>
        </div>
      </div>

      {/* Tagline */}
      <p style={{
        fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7,
        marginBottom: 14, flex: 1,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {company.tagline}
      </p>

      {/* Freshness badge + work style tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14, alignItems: "center" }}>
        {isFresh && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 5,
            background: "var(--success-soft, #ECFDF5)", color: "var(--success)",
            border: "1px solid #A7F3D0",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
            {freshLabel}
          </span>
        )}
        {company.work_styles.slice(0, 3).map((tag) => (
          <span key={tag} style={{
            fontSize: 10.5, padding: "3px 9px", borderRadius: 100,
            background: "var(--bg-tint)", color: "var(--ink-soft)",
            border: "1px solid var(--line)", fontWeight: 500,
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Card footer: jobs + mentors */}
      <div style={{
        marginTop: "auto", paddingTop: 14,
        borderTop: "1px solid var(--line-soft, #F1F5F9)",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
      }}>
        {/* Jobs */}
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "10px 12px", borderRadius: 8,
          background: company.job_count > 0 ? "var(--royal-50)" : "var(--bg-tint)",
          border: `1px solid ${company.job_count > 0 ? "var(--royal-100)" : "var(--line)"}`,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, color: company.job_count > 0 ? "var(--royal)" : "var(--ink-mute)",
            fontWeight: 600, marginBottom: 2,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
            求人
          </div>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 700,
            color: company.job_count > 0 ? "var(--royal)" : "var(--ink-mute)",
          }}>
            {company.job_count}
            <span style={{ fontSize: 11, fontWeight: 400 }}> 件</span>
          </div>
        </div>

        {/* Mentors */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <MentorRow
            count={company.current_mentors}
            label="現役社員"
            colorScheme="success"
          />
          <MentorRow
            count={company.alumni_mentors}
            label="OBOG"
            colorScheme="purple"
          />
        </div>
      </div>

      {/* Updated date */}
      {!isFresh && (
        <div style={{
          position: "absolute", bottom: 10, right: 14,
          fontSize: 9, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", opacity: 0.7,
        }}>
          {freshLabel}
        </div>
      )}
    </Link>
  );
}

function MentorRow({
  count,
  label,
  colorScheme,
}: {
  count: number;
  label: string;
  colorScheme: "success" | "purple";
}) {
  const colors = {
    success: { bg: "var(--success-soft, #ECFDF5)", color: "var(--success)", border: "#A7F3D0" },
    purple: { bg: "var(--purple-soft, #F5F3FF)", color: "var(--purple)", border: "#E9D5FF" },
  };
  const c = count > 0 ? colors[colorScheme] : { bg: "var(--bg-tint)", color: "var(--ink-mute)", border: "var(--line)" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      opacity: count === 0 ? 0.4 : 1,
      flex: 1,
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      </svg>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700 }}>{count}</span>
      {label}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const allCompanies = await getCompanies();

  const params = {
    industry:  typeof searchParams.industry  === "string" ? searchParams.industry  : undefined,
    phase:     typeof searchParams.phase     === "string" ? searchParams.phase     : undefined,
    employees: typeof searchParams.employees === "string" ? searchParams.employees : undefined,
    meeting:   typeof searchParams.meeting   === "string" ? searchParams.meeting   : undefined,
    sort:      typeof searchParams.sort      === "string" ? searchParams.sort      : undefined,
  };

  const companies = filterCompanies(allCompanies, params);
  const total = companies.length;

  return (
    <>
      <Header />

      {/* Page top */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 py-8 md:px-12">
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
            <h1 style={{
              fontFamily: '"Noto Serif JP", serif',
              fontSize: "clamp(22px,2.5vw,28px)", fontWeight: 500,
              color: "var(--ink)", letterSpacing: "0.01em",
            }}>
              IT/SaaS企業を知る
            </h1>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 700,
              color: "var(--royal)", display: "flex", alignItems: "center", gap: 4,
            }}>
              {allCompanies.length}社
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-mute)" }}>掲載中</span>
            </span>
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            Opinio編集部が取材した企業の最新情報、求人、先輩相談をまとめて確認できます。
          </p>
        </div>
      </div>

      {/* Filter bar — needs Suspense because it uses useSearchParams */}
      <Suspense fallback={<div style={{ height: 56, background: "#fff", borderBottom: "1px solid var(--line)" }} />}>
        <CompanyFilterBar total={total} />
      </Suspense>

      {/* Grid */}
      <main style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          {companies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--ink-soft)" }}>
                条件に合う企業が見つかりませんでした
              </p>
              <p style={{ fontSize: 14 }}>フィルターを変更してみてください</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Card hover styles */}
      <style>{`
        .company-card-link:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 16px 40px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
        .company-card-link:focus-visible {
          outline: 2px solid var(--royal);
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
