import type { Metadata } from "next";
import { Suspense } from "react";
import { getJobs, getParentRoles } from "@/lib/supabase/queries";
import JobsClient from "./JobsClient";

export const metadata: Metadata = {
  title: "求人を見つける — OPINIO",
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

  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
            color: "var(--ink-mute)",
            fontSize: 15,
          }}
        >
          読み込み中...
        </div>
      }
    >
      <JobsClient jobs={jobs} companies={companies} parentRoles={parentRoles} />
    </Suspense>
  );
}
