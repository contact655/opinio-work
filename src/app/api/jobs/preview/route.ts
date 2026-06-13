import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート",
  hybrid: "ハイブリッド",
  on_site: "原則出社",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "3", 10), 9);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_jobs")
    .select("id, title, job_category, salary_min, salary_max, work_style, employment_type, location, ow_companies!inner(id, name, logo_letter, logo_gradient, logo_url)")
    .in("status", ["published", "active"])
    .order("published_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ jobs: [] });

  // 1社1件に絞る（多様性確保）
  const seen = new Set<string>();
  const diverseJobs = (data ?? [])
    .map((row: any) => {
      const co = row.ow_companies;
      const rawWs = row.work_style as string | null;
      return {
        id: row.id,
        title: row.title,
        dept: row.job_category,
        salaryMin: row.salary_min,
        salaryMax: row.salary_max,
        workStyle: rawWs ? (WORK_STYLE_LABELS[rawWs] ?? rawWs) : null,
        employmentType: row.employment_type ?? null,
        location: row.location ?? null,
        companyName: co?.name ?? "",
        logoLetter: co?.logo_letter ?? (co?.name ?? "?").charAt(0).toUpperCase(),
        logoGradient: co?.logo_gradient ?? "linear-gradient(135deg,var(--royal),#3B5FD9)",
        logoUrl: co?.logo_url ?? null,
        _companyId: co?.id ?? "",
      };
    })
    .filter((job: any) => {
      if (seen.has(job._companyId)) return false;
      seen.add(job._companyId);
      return true;
    })
    .map(({ _companyId: _c, ...j }: any) => j)
    .slice(0, limit);

  return NextResponse.json({ jobs: diverseJobs });
}
