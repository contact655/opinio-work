import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get("company_id");
  if (!companyId) {
    return NextResponse.json({ error: "company_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 企業の所有者確認
  const { data: company } = await admin
    .from("ow_companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // 求人一覧取得
  const { data: jobs, error } = await admin
    .from("ow_jobs")
    .select("id, title, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 各求人の応募数を取得
  const jobsWithCounts = await Promise.all(
    (jobs || []).map(async (job) => {
      const { count } = await admin
        .from("ow_applications")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id);
      return { ...job, application_count: count || 0 };
    })
  );

  return NextResponse.json({ jobs: jobsWithCounts });
}
