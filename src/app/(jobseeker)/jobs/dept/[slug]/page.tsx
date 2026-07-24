import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobs } from "@/lib/supabase/queries";
import { CompanyLogo } from "@/components/common/CompanyLogo";

export const revalidate = 3600;

// ─── カテゴリ定義 ─────────────────────────────────────────────────────────────

const DEPT_SLUG_MAP: Record<string, {
  label: string;
  labelEn: string;
  description: string;
  jobCategories: string[];
}> = {
  sales: {
    label: "セールス・CS",
    labelEn: "Sales & Customer Success",
    description: "IT/SaaS企業のフィールドセールス・インサイドセールス・SDR・BDR・カスタマーサクセス求人。",
    jobCategories: ["フィールドセールス", "インサイドセールス", "SDR", "BDR", "カスタマーサクセス", "カスタマーサポート"],
  },
  marketing: {
    label: "マーケティング",
    labelEn: "Marketing",
    description: "IT/SaaS企業のマーケティング・プロダクトマーケティング求人。",
    jobCategories: ["マーケティング", "プロダクトマーケティング"],
  },
  management: {
    label: "経営・事業開発",
    labelEn: "Management & Business Development",
    description: "IT/SaaS企業の経営・事業開発・BizDev求人。",
    jobCategories: ["経営・CxO", "事業開発", "事業開発・BizDev"],
  },
  corporate: {
    label: "コーポレート",
    labelEn: "Corporate",
    description: "IT/SaaS企業のHR・人事・財務・経理・法務・コーポレート求人。",
    jobCategories: ["コーポレート", "HR・人事", "財務・経理", "法務"],
  },
  product: {
    label: "プロダクト・デザイン",
    labelEn: "Product & Design",
    description: "IT/SaaS企業のプロダクトマネージャー・デザイナー・データサイエンティスト求人。",
    jobCategories: ["プロダクトマネージャー", "デザイナー", "データサイエンティスト"],
  },
  engineer: {
    label: "ソフトウェアエンジニア",
    labelEn: "Software Engineer",
    description: "IT/SaaS企業のバックエンド・フロントエンド・フルスタックエンジニア求人。",
    jobCategories: ["バックエンド", "フロントエンド", "フルスタック"],
  },
  infra: {
    label: "インフラ・SRE",
    labelEn: "Infrastructure & SRE",
    description: "IT/SaaS企業のSRE・インフラ・iOS/Androidエンジニア求人。",
    jobCategories: ["SRE/インフラ", "iOS/Android"],
  },
};

export async function generateStaticParams() {
  return Object.keys(DEPT_SLUG_MAP).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = DEPT_SLUG_MAP[params.slug];
  if (!cat) return { title: { absolute: "求人 | OPINIO" } };

  const title = `${cat.label}の求人 | OPINIO`;
  const description = `${cat.description} IT/SaaS業界特化の転職プラットフォームOPINIOで探す。`;

  return {
    title: { absolute: title },
    description,
    keywords: [cat.label, "IT転職", "SaaS求人", "転職", cat.labelEn],
    alternates: { canonical: `/jobs/dept/${params.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/jobs/dept/${params.slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(min: number, max: number): string {
  const fmt = (v: number) => v.toLocaleString("ja-JP");
  if (min && max) return `${fmt(min)}〜${fmt(max)}万円`;
  if (min) return `${fmt(min)}万円〜`;
  if (max) return `〜${fmt(max)}万円`;
  return "応相談";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function JobDeptPage({ params }: { params: { slug: string } }) {
  const cat = DEPT_SLUG_MAP[params.slug];
  if (!cat) notFound();

  const { jobs, companies } = await getJobs();

  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const filteredJobs = jobs.filter((j) =>
    cat.jobCategories.some(
      (cat) => j.dept === cat || (j.role ?? "").includes(cat)
    )
  );

  return (
    <>
    <style>{`
      .dept-job-card-link { text-decoration: none; display: block; }
      .dept-job-card {
        background: #fff; border: 1px solid var(--line); border-radius: 16px;
        padding: 20px 22px; transition: box-shadow 0.15s, border-color 0.15s;
      }
      .dept-job-card-link:hover .dept-job-card {
        box-shadow: 0 4px 20px rgba(0,35,102,0.10); border-color: var(--royal-100);
      }
      .dept-cat-chip {
        display: block; padding: 12px 14px; border-radius: 12px;
        background: #fff; border: 1px solid var(--line);
        text-decoration: none; font-size: 13px; font-weight: 600; color: var(--ink);
        transition: border-color 0.15s, background 0.15s;
      }
      .dept-cat-chip:hover { border-color: var(--royal-100); background: var(--royal-50); }
    `}</style>
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 80px" }}>
      {/* ─ ヘッダー ─ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Link href="/jobs" style={{ fontSize: 12, color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500 }}>
            求人
          </Link>
          <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>›</span>
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>{cat.label}</span>
        </div>
        <h1 style={{
          fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
          fontSize: "clamp(22px, 3vw, 32px)",
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 0 10px",
          lineHeight: 1.3,
        }}>
          {cat.label}の求人
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.6 }}>
          {cat.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            background: "var(--royal-50)", color: "var(--royal)",
            padding: "4px 14px", borderRadius: 100,
            border: "1px solid var(--royal-100)",
          }}>
            {filteredJobs.length}件の求人
          </span>
          <Link href={`/jobs?dept=${encodeURIComponent(cat.jobCategories[0])}`} style={{
            fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
          }}>
            フィルタで絞り込む →
          </Link>
        </div>
      </div>

      {/* ─ 求人リスト ─ */}
      {filteredJobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-mute)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, margin: 0 }}>現在この職種の求人はありません</p>
          <Link href="/jobs" style={{ display: "inline-block", marginTop: 16, fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
            全求人を見る →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredJobs.map((job) => {
            const company = companyMap.get(job.company_id);
            const hasSalary = (job.salary_min ?? 0) > 0 || (job.salary_max ?? 0) > 0;
            const jobUrl = `/jobs/${job.slug ?? job.id}`;

            return (
              <Link
                key={job.id}
                href={jobUrl}
                className="dept-job-card-link"
              >
                <div className="dept-job-card">
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    {/* ロゴ */}
                    {company && (
                      <CompanyLogo
                        name={company.name}
                        logoUrl={company.logo_url ?? null}
                        logoLetter={company.logo_letter ?? null}
                        logoGradient={company.gradient ?? null}
                        size={44}
                        borderRadius={10}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 会社名 */}
                      {company && (
                        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 3, fontWeight: 500 }}>
                          {company.name}
                        </div>
                      )}
                      {/* 求人タイトル */}
                      <div style={{
                        fontSize: 15, fontWeight: 700, color: "var(--ink)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        marginBottom: 6,
                      }}>
                        {job.role}
                      </div>
                      {/* メタ情報 */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {hasSalary && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success)", fontFamily: "Inter, sans-serif" }}>
                            {formatSalary(job.salary_min, job.salary_max)}
                          </span>
                        )}
                        {job.work_style && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                            background: "var(--royal-50)", color: "var(--royal)",
                            border: "1px solid var(--royal-100)",
                          }}>
                            {job.work_style}
                          </span>
                        )}
                        {job.location && (
                          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                            📍 {job.location}
                          </span>
                        )}
                        {job.is_new && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                            background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A",
                          }}>
                            NEW
                          </span>
                        )}
                      </div>
                      {/* キャッチコピー */}
                      {job.highlight && (
                        <div style={{
                          fontSize: 12, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.5,
                          overflow: "hidden", display: "-webkit-box",
                          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        }}>
                          {job.highlight}
                        </div>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 4 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ─ 他カテゴリへのリンク ─ */}
      <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--line)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16, marginTop: 0 }}>
          他の職種カテゴリ
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {Object.entries(DEPT_SLUG_MAP)
            .filter(([slug]) => slug !== params.slug)
            .map(([slug, info]) => (
              <Link
                key={slug}
                href={`/jobs/dept/${slug}`}
                className="dept-cat-chip"
              >
                {info.label}
              </Link>
            ))}
        </div>
      </div>

      {/* ─ CTA ─ */}
      <div style={{
        marginTop: 40, padding: "28px 24px", borderRadius: 16,
        background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
        textAlign: "center",
      }}>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
          気になる求人が見つかったら、企業の先輩に話を聞いてみましょう。
        </p>
        <Link href="/companies" style={{
          display: "inline-block", padding: "10px 28px", borderRadius: 100,
          background: "#fff", color: "var(--royal)",
          fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}>
          企業を探す →
        </Link>
      </div>
    </div>
    </>
  );
}
