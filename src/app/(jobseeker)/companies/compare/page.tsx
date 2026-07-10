import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import CompareClient from "./CompareClient";

export const revalidate = 0;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { ids?: string };
}) {
  const ids = (searchParams.ids ?? "").split(",").filter(Boolean).slice(0, 3);

  if (ids.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>企業比較</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 24 }}>
          企業一覧ページで「比較に追加」して最大3社を比較できます。
        </p>
        <Link href="/companies" style={{ padding: "10px 24px", background: "var(--royal)", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          企業を探す →
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("ow_companies")
    .select(`
      id, name, industry, phase, tagline, employee_count,
      avg_salary, avg_age, female_ratio,
      remote_work_status, flex_time, side_job_ok,
      accepting_casual_meetings, logo_gradient, logo_letter, logo_url,
      fit_positives, fit_negatives
    `)
    .in("id", ids);

  const companies = (data ?? []).sort(
    (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
  );

  return <CompareClient companies={companies} />;
}
