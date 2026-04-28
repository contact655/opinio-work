import type { Metadata } from "next";
import { Suspense } from "react";
import { getJobs } from "@/lib/supabase/queries";
import JobsClient from "./JobsClient";

export const metadata: Metadata = {
  title: "求人を見つける — Opinio",
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の最新求人情報。フルリモート・高年収・PdM・エンジニア求人を検索。",
};

export default async function JobsPage() {
  const { jobs, companies } = await getJobs();

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
      <JobsClient jobs={jobs} companies={companies} />
    </Suspense>
  );
}
