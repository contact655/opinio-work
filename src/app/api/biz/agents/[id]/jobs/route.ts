import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

// PUT /api/biz/agents/[id]/jobs — replace all assigned jobs
// Body: { jobIds: string[] }
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  let body: { jobIds: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify agency belongs to company
  const { data: agency } = await admin
    .from("ow_agent_agencies")
    .select("id")
    .eq("id", params.id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobIds = Array.isArray(body.jobIds) ? body.jobIds : [];

  // Delete existing, then insert new ones
  const { error: delErr } = await admin
    .from("ow_agent_jobs")
    .delete()
    .eq("agency_id", params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (jobIds.length > 0) {
    const rows = jobIds.map((jobId) => ({ agency_id: params.id, job_id: jobId }));
    const { error: insErr } = await admin.from("ow_agent_jobs").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, jobIds });
}
