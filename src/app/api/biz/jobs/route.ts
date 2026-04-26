import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function buildJobRecord(body: Record<string, unknown>, companyId: string) {
  const salaryMin = body.salaryMin ? parseInt(String(body.salaryMin)) : null;
  const salaryMax = body.salaryMax ? parseInt(String(body.salaryMax)) : null;
  return {
    company_id: companyId,
    title: body.title as string || null,
    employment_type: body.employmentType as string || null,
    job_category: body.jobCategory as string || null,
    department: body.department as string || null,
    salary_min: isNaN(salaryMin as number) ? null : salaryMin,
    salary_max: isNaN(salaryMax as number) ? null : salaryMax,
    salary_note: body.salaryNote as string || null,
    location: body.location as string || null,
    remote_work_status: body.remoteWorkStatus as string || null,
    probation_period: body.probationPeriod as string || null,
    description_markdown: body.descriptionMarkdown as string || null,
    message_to_candidates: body.messageToCandidates as string || null,
    required_skills: Array.isArray(body.requiredSkills) ? body.requiredSkills : [],
    preferred_skills: Array.isArray(body.preferredSkills) ? body.preferredSkills : [],
    culture_fit: body.cultureFit as string || null,
    selection_steps: Array.isArray(body.selectionSteps) ? body.selectionSteps : [],
    selection_duration: body.selectionDuration as string || null,
    start_date_preference: body.startDatePreference as string || null,
    status: "draft",
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── 複製モード ──────────────────────────────────────────
  if (body.sourceId) {
    const sourceId = body.sourceId as string;
    const { data: source } = await supabase
      .from("ow_jobs")
      .select(
        "company_id, title, employment_type, job_category, department, salary_min, salary_max, salary_note, location, remote_work_status, probation_period, description_markdown, message_to_candidates, required_skills, preferred_skills, culture_fit, selection_steps, selection_duration, start_date_preference"
      )
      .eq("id", sourceId)
      .single();

    if (!source) return NextResponse.json({ error: "source job not found" }, { status: 404 });

    const now = new Date().toISOString();
    const { data: newJob, error: insertErr } = await supabase
      .from("ow_jobs")
      .insert({
        ...source,
        company_id: source.company_id,
        title: `${source.title ?? "求人"} のコピー`,
        status: "draft",
        published_at: null,
        submitted_at: null,
        rejection_reason: null,
        rejection_date: null,
        rejection_reviewer: null,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertErr || !newJob) {
      console.error("[jobs POST duplicate]", insertErr?.message);
      return NextResponse.json({ error: insertErr?.message ?? "Failed" }, { status: 500 });
    }

    // 担当者も複製
    const { data: srcAssignees } = await supabase
      .from("ow_job_assignees")
      .select("user_id")
      .eq("job_id", sourceId);

    if (srcAssignees?.length) {
      await supabase.from("ow_job_assignees").insert(
        srcAssignees.map((a) => ({ job_id: newJob.id, user_id: a.user_id }))
      );
    }

    return NextResponse.json({ id: newJob.id });
  }

  // ── 新規作成モード ────────────────────────────────────────
  const companyId = body.companyId as string | undefined;
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const record = buildJobRecord(body, companyId);
  const { data: newJob, error: insertErr } = await supabase
    .from("ow_jobs")
    .insert(record)
    .select("id")
    .single();

  if (insertErr || !newJob) {
    console.error("[jobs POST create]", insertErr?.message);
    return NextResponse.json({ error: insertErr?.message ?? "Failed" }, { status: 500 });
  }

  const assigneeIds = Array.isArray(body.assigneeIds) ? (body.assigneeIds as string[]) : [];
  if (assigneeIds.length > 0) {
    await supabase.from("ow_job_assignees").insert(
      assigneeIds.map((uid) => ({ job_id: newJob.id, user_id: uid }))
    );
  }

  return NextResponse.json({ id: newJob.id });
}
