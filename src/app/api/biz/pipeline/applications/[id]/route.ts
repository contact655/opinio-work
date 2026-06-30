import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

// PATCH /api/biz/pipeline/applications/[id]
// Body: { pipeline_stage_id?: string | null, memo?: string }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  let body: { pipeline_stage_id?: string | null; memo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("pipeline_stage_id" in body) {
    if (body.pipeline_stage_id) {
      const { data: stage } = await supabase
        .from("ow_pipeline_stages")
        .select("id")
        .eq("id", body.pipeline_stage_id)
        .eq("company_id", ctx.companyId)
        .maybeSingle();
      if (!stage) return NextResponse.json({ error: "Invalid pipeline_stage_id" }, { status: 400 });
    }
    updates.pipeline_stage_id = body.pipeline_stage_id ?? null;
  }
  if ("memo" in body) {
    if (body.memo !== null && body.memo !== undefined && typeof body.memo === "string" && body.memo.length > 5000) {
      return NextResponse.json({ error: "memo は5000文字以内で入力してください" }, { status: 400 });
    }
    updates.memo = body.memo ?? null;
  }

  // Verify the application belongs to this company (via ow_jobs.company_id)
  const { data: app } = await supabase
    .from("ow_job_applications")
    .select("id, ow_jobs!inner(company_id)")
    .eq("id", params.id)
    .maybeSingle();

  const appJob = app
    ? (Array.isArray((app as Record<string, unknown>).ow_jobs)
        ? ((app as Record<string, unknown>).ow_jobs as { company_id: string }[])[0]
        : (app as Record<string, unknown>).ow_jobs as { company_id: string } | null)
    : null;

  if (!app || appJob?.company_id !== ctx.companyId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Ownership already verified above via ow_jobs.company_id join — safe to update by id only
  const { error } = await supabase
    .from("ow_job_applications")
    .update(updates)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
