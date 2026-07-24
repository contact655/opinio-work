import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobs } from "@/lib/supabase/queries";
import { SALARY_SLUG_MAP, buildSalaryStats, getJobsForSlug } from "../salaryData";

export const revalidate = 3600;

export async function generateStaticParams() {
  return Object.keys(SALARY_SLUG_MAP).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const info = SALARY_SLUG_MAP[params.slug];
  if (!info) return { title: { absolute: "年収相場 | OPINIO" } };

  const title = `${info.label}の年収相場 | OPINIO`;
  const description = `${info.description} 外資系・SaaS企業の実際の求人データから集計した${info.label}の年収レンジ。`;

  return {
    title: { absolute: title },
    description,
    keywords: [info.label, info.labelEn, "年収", "転職", "SaaS", "外資系"],
    alternates: { canonical: `/salary/${params.slug}` },
    openGraph: { title, description, type: "website", url: `/salary/${params.slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SalaryDetailPage({ params }: { params: { slug: string } }) {
  const info = SALARY_SLUG_MAP[params.slug];
  if (!info) notFound();

  const { jobs, companies } = await getJobs();
  const companyMap = new Map(companies.map((c) => [c.id, { name: c.name, slug: c.slug ?? null }]));

  const stats = buildSalaryStats(jobs);
  const myStat = stats.find((s) => s.slug === params.slug);
  const jobList = getJobsForSlug(jobs, companyMap, params.slug);

  const otherStats = stats.filter((s) => s.slug !== params.slug).slice(0, 6);

  // bar positioning: min〜max on a 0〜maxSalary scale
  const barMax = myStat ? Math.max(myStat.maxSalary, 2500) : 2500;

  return (
    <>
      <style>{`
        .sd-job-link { text-decoration:none; display:block; }
        .sd-job-card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px 20px; transition:box-shadow .15s,border-color .15s; }
        .sd-job-link:hover .sd-job-card { box-shadow:0 4px 20px rgba(0,35,102,.10); border-color:var(--royal-100); }
        .sd-other-chip { display:block; padding:10px 14px; border-radius:12px; background:#fff; border:1px solid var(--line); text-decoration:none; font-size:13px; font-weight:600; color:var(--ink); transition:border-color .15s,background .15s; }
        .sd-other-chip:hover { border-color:var(--royal-100); background:var(--royal-50); }
      `}</style>

      {/* ─ ヘッダー ─ */}
      <div style={{ background: "linear-gradient(155deg,#edf0fa 0%,#ece8ff 40%,#f6f0ff 70%,#fff 100%)", padding: "40px 24px 36px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12 }}>
            <Link href="/salary" style={{ color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500 }}>年収相場</Link>
            <span style={{ color: "var(--ink-mute)" }}>›</span>
            <span style={{ color: "var(--royal)", fontWeight: 600 }}>{info.label}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 10 }}>
            {info.labelEn}
          </div>
          <h1 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(22px,3.2vw,34px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.3 }}>
            {info.label}の年収相場
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7, maxWidth: 540 }}>
            {info.description}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 80px" }}>

        {myStat ? (
          <>
            {/* ─ 年収サマリーカード ─ */}
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 20, padding: "28px 28px 24px", marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginBottom: 16 }}>
                求人{myStat.jobCount}件の平均レンジ
              </div>

              {/* 大きな年収表示 */}
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, color: "var(--success)", fontFamily: "Inter,sans-serif", lineHeight: 1 }}>
                  {myStat.avgMin}〜{myStat.avgMax}
                </span>
                <span style={{ fontSize: 16, color: "var(--ink-soft)", marginLeft: 8 }}>万円</span>
              </div>

              {/* ビジュアルバー */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ position: "relative", height: 20, background: "var(--line-soft)", borderRadius: 100, overflow: "visible" }}>
                  {/* range bar */}
                  <div style={{
                    position: "absolute",
                    left: `${(myStat.minSalary / barMax) * 100}%`,
                    width: `${((myStat.maxSalary - myStat.minSalary) / barMax) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,var(--royal),#3B5FD9)",
                    borderRadius: 100,
                    opacity: 0.25,
                  }} />
                  {/* avg bar */}
                  <div style={{
                    position: "absolute",
                    left: `${(myStat.avgMin / barMax) * 100}%`,
                    width: `${((myStat.avgMax - myStat.avgMin) / barMax) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,var(--royal),#3B5FD9)",
                    borderRadius: 100,
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
                  <span>0</span>
                  <span>{Math.round(barMax / 2)}万</span>
                  <span>{barMax}万円</span>
                </div>
              </div>

              {/* ミニ統計 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {[
                  { label: "最低", val: `${myStat.minSalary.toLocaleString("ja-JP")}万円` },
                  { label: "平均レンジ", val: `${myStat.avgMin.toLocaleString("ja-JP")}〜${myStat.avgMax.toLocaleString("ja-JP")}万円`, highlight: true },
                  { label: "最高", val: `${myStat.maxSalary.toLocaleString("ja-JP")}万円` },
                ].map(({ label, val, highlight }) => (
                  <div key={label} style={{ textAlign: "center", padding: "10px 8px", background: highlight ? "var(--royal-50)" : "var(--bg-tint)", borderRadius: 10, border: `1px solid ${highlight ? "var(--royal-100)" : "var(--line)"}` }}>
                    <div style={{ fontSize: 10, color: highlight ? "var(--royal)" : "var(--ink-mute)", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? "var(--royal)" : "var(--ink)", fontFamily: "Inter,sans-serif" }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, fontSize: 11, color: "var(--ink-mute)" }}>
                ※ OPINIOに掲載中の求人票の給与レンジをもとに集計。企業・経験・スキルにより異なります。
              </div>
            </div>

            {/* ─ 年収交渉のヒント ─ */}
            <div style={{ background: "var(--warm-soft)", border: "1px solid #FDE68A", borderRadius: 16, padding: "20px 22px", marginBottom: 28 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#92400E", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                年収交渉のポイント
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#78350F", lineHeight: 1.8 }}>
                {info.tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <p style={{ fontSize: 14, margin: 0 }}>この職種の求人データはまだありません</p>
          </div>
        )}

        {/* ─ 実際の求人 ─ */}
        {jobList.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 14px" }}>
              {info.label}の求人（{jobList.length}件）
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {jobList.map((job) => (
                <Link key={job.id} href={`/jobs/${job.slug ?? job.id}`} className="sd-job-link">
                  <div className="sd-job-card">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {job.companyName && (
                          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 3, fontWeight: 500 }}>{job.companyName}</div>
                        )}
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
                          {job.title}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          {(job.salaryMin > 0 || job.salaryMax > 0) && (
                            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--success)", fontFamily: "Inter,sans-serif" }}>
                              {job.salaryMin > 0 && job.salaryMax > 0
                                ? `${job.salaryMin.toLocaleString("ja-JP")}〜${job.salaryMax.toLocaleString("ja-JP")}万円`
                                : job.salaryMin > 0 ? `${job.salaryMin.toLocaleString("ja-JP")}万円〜` : `〜${job.salaryMax.toLocaleString("ja-JP")}万円`}
                            </span>
                          )}
                          {job.workStyle && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                              {job.workStyle}
                            </span>
                          )}
                          {job.location && (
                            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>📍 {job.location}</span>
                          )}
                          {job.isNew && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A" }}>NEW</span>
                          )}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 4 }}>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <Link href="/jobs" style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                すべての求人を見る →
              </Link>
            </div>
          </div>
        )}

        {/* ─ 他の職種 ─ */}
        {otherStats.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 14px" }}>他の職種の年収相場</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
              {otherStats.map((s) => (
                <Link key={s.slug} href={`/salary/${s.slug}`} className="sd-other-chip">
                  <div style={{ marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 700, fontFamily: "Inter,sans-serif" }}>
                    {s.avgMin}〜{s.avgMax}万
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ─ CTA ─ */}
        <div style={{ padding: "28px 24px", borderRadius: 16, background: "linear-gradient(135deg,var(--royal),#3B5FD9)", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
            年収や職場の実態は、現役社員に直接聞くのが確実です。
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/companies" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              企業の先輩に聞く →
            </Link>
            <Link href="/salary" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)" }}>
              ← 年収相場一覧
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
