import type { Metadata } from "next";
import { Suspense } from "react";
import { getJobs, getParentRoles, getJobAlumniMap } from "@/lib/supabase/queries";
import JobsClient from "./JobsClient";

// 5分間ページキャッシュ（ISR）
export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS求人を探す | OPINIO" },
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の最新求人情報。フルリモート・高年収・PdM・エンジニア求人を検索。",
  keywords: ["IT転職", "SaaS求人", "エンジニア転職", "PdM求人", "フルリモート", "高年収", "OPINIO"],
  alternates: { canonical: "/jobs" },
  openGraph: {
    title: "IT/SaaS求人を探す | OPINIO",
    description: "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の最新求人情報。フルリモート・高年収・PdM・エンジニア求人を検索。",
    type: "website",
    url: "/jobs",
    images: [{ url: "/api/og?type=list&title=%E6%B1%82%E4%BA%BA%E3%82%92%E6%8E%A2%E3%81%99&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E6%9C%80%E6%96%B0%E6%B1%82%E4%BA%BA%E6%83%85%E5%A0%B1", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default async function JobsPage() {
  const [{ jobs, companies }, parentRoles] = await Promise.all([
    getJobs(),
    getParentRoles(),
  ]);

  const alumniMap = await getJobAlumniMap(
    jobs.map((j) => ({ jobId: j.id, companyId: j.company_id, jobCategory: j.dept ?? null }))
  );

  return (
    <Suspense
      fallback={
        <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 48, borderRadius: 12, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 44, borderRadius: 8, marginBottom: 20, maxWidth: 500 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 130, borderRadius: 16 }} />
            ))}
          </div>
        </div>
      }
    >
      <JobsClient jobs={jobs} companies={companies} parentRoles={parentRoles} alumniMap={alumniMap} />
    </Suspense>
  );
}
