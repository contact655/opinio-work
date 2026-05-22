import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_jobs")
    .select("id, title, job_category, salary_min, salary_max, work_style, company_id, ow_companies!inner(id, name, logo_letter, logo_gradient, logo_url)")
    .in("status", ["published", "active"])
    .order("updated_at", { ascending: false })
    .limit(3);

  if (error) return NextResponse.json({ jobs: [] });

  const jobs = (data ?? []).map((row: any) => {
    const co = row.ow_companies;
    return {
      id: row.id,
      title: row.title,
      dept: row.job_category,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      workStyle: row.work_style,
      companyName: co?.name ?? "",
      logoLetter: co?.logo_letter ?? (co?.name ?? "?").charAt(0).toUpperCase(),
      logoGradient: co?.logo_gradient ?? "linear-gradient(135deg,#002366,#3B5FD9)",
      logoUrl: co?.logo_url ?? null,
    };
  });

  return NextResponse.json({ jobs });
}
