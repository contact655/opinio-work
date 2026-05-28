import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// POST /api/agent/recommend
// Body: { jobId, name, email, phone?, reason, memo? }
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find contact for this user's email
  const { data: contact } = await admin
    .from("ow_agent_contacts")
    .select("id, agency_id")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ error: "エージェントアカウントが見つかりません" }, { status: 403 });
  }

  // Verify agency is still active
  const { data: agency } = await admin
    .from("ow_agent_agencies")
    .select("id, is_active")
    .eq("id", contact.agency_id)
    .maybeSingle();

  if (!agency || !agency.is_active) {
    return NextResponse.json({ error: "このアカウントは利用できません" }, { status: 403 });
  }

  let body: { jobId: string; name: string; email: string; phone?: string; reason: string; memo?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "候補者氏名は必須です" }, { status: 400 });
  if (!body.email?.trim()) return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  if (!body.reason?.trim()) return NextResponse.json({ error: "推薦理由は必須です" }, { status: 400 });

  // Verify the job is assigned to this agency
  const { data: agentJob } = await admin
    .from("ow_agent_jobs")
    .select("job_id")
    .eq("agency_id", agency.id)
    .eq("job_id", body.jobId)
    .maybeSingle();

  if (!agentJob) {
    return NextResponse.json({ error: "この求人への推薦権限がありません" }, { status: 403 });
  }

  // Compose memo: reason + optional memo
  const fullMemo = body.memo
    ? `【推薦理由】${body.reason}\n\n【メモ】${body.memo}`
    : `【推薦理由】${body.reason}`;

  const { data, error } = await admin
    .from("ow_job_applications")
    .insert({
      job_id: body.jobId,
      user_id: null,
      external_name: body.name.trim(),
      external_email: body.email.trim(),
      source: "agent",
      agency_id: agency.id,
      memo: fullMemo,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, application: data }, { status: 201 });
}
