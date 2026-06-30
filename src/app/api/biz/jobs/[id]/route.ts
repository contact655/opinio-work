import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

function str(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.slice(0, max) || null : null;
}

const VALID_STATUSES = new Set(["draft", "pending_review", "published", "rejected", "private"]);

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 権限チェック: admin のみ求人を編集できる
  const cookieCompanyId0 = cookies().get("biz_current_company_id")?.value;
  const ctx0 = await getCompanyContext(supabase, user.id, cookieCompanyId0);
  if (!ctx0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { requireAdmin(ctx0.allMemberships, ctx0.companyId); } catch { return permissionDeniedResponse(); }

  const salaryMin = body.salaryMin ? parseInt(String(body.salaryMin)) : null;
  const salaryMax = body.salaryMax ? parseInt(String(body.salaryMax)) : null;
  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("ow_jobs")
    .update({
      title: str(body.title, 200),
      employment_type: str(body.employmentType, 50),
      job_category: str(body.jobCategory, 100),
      department: str(body.department, 100),
      salary_min: isNaN(salaryMin as number) ? null : salaryMin,
      salary_max: isNaN(salaryMax as number) ? null : salaryMax,
      salary_note: str(body.salaryNote, 200),
      location: str(body.location, 200),
      remote_work_status: str(body.remoteWorkStatus, 50),
      probation_period: str(body.probationPeriod, 100),
      description_markdown: str(body.descriptionMarkdown, 50000),
      message_to_candidates: str(body.messageToCandidates, 2000),
      required_skills: Array.isArray(body.requiredSkills) ? body.requiredSkills : [],
      preferred_skills: Array.isArray(body.preferredSkills) ? body.preferredSkills : [],
      culture_fit: str(body.cultureFit, 2000),
      selection_steps: Array.isArray(body.selectionSteps) ? body.selectionSteps : [],
      selection_duration: str(body.selectionDuration, 100),
      start_date_preference: str(body.startDatePreference, 100),
      urgency: (body.urgency === "hot") ? "hot" : "open",
      why_hire: str(body.whyHire, 5000),
      team_composition: str(body.teamComposition, 5000),
      first_90_days: str(body.first90Days, 5000),
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("company_id", ctx0.companyId);

  if (updateErr) {
    console.error("[jobs PUT]", updateErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Option A: 担当者を完全 replace
  const assigneeIds = Array.isArray(body.assigneeIds) ? (body.assigneeIds as string[]) : [];
  await supabase.from("ow_job_assignees").delete().eq("job_id", jobId);
  if (assigneeIds.length > 0) {
    const { data: validMembers } = await supabase
      .from("ow_company_admins")
      .select("user_id")
      .eq("company_id", ctx0.companyId)
      .in("user_id", assigneeIds);
    const validIds = new Set((validMembers ?? []).map((m: { user_id: string }) => m.user_id));
    const safeAssigneeIds = assigneeIds.filter((uid: string) => validIds.has(uid));
    if (safeAssigneeIds.length > 0) {
      await supabase
        .from("ow_job_assignees")
        .insert(safeAssigneeIds.map((uid: string) => ({ job_id: jobId, user_id: uid })));
    }
  }

  // Activity: job_updated (best-effort) — ctx0 を再利用
  const jobRow = await supabase.from("ow_jobs").select("company_id, title").eq("id", jobId).maybeSingle();
  if (jobRow.data?.company_id) {
    await insertActivity(supabase, {
      company_id: jobRow.data.company_id,
      actor_user_id: ctx0.owUserId,
      type: "job_updated",
      description: `求人「${jobRow.data.title ?? "—"}」の内容を更新しました`,
      target_type: "job",
      target_id: jobId,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "status") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  // 権限チェック: admin のみステータス変更できる
  const cookieCompanyId1 = cookies().get("biz_current_company_id")?.value;
  const ctx1 = await getCompanyContext(supabase, user.id, cookieCompanyId1);
  if (!ctx1) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { requireAdmin(ctx1.allMemberships, ctx1.companyId); } catch { return permissionDeniedResponse(); }

  const newStatus = body.value ?? "";
  if (!VALID_STATUSES.has(newStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = { status: newStatus, updated_at: now };

  // When submitting for review, record submission time if column exists
  if (newStatus === "pending_review") {
    patch.submitted_at = now;
  }
  // When withdrawing to draft, clear submission time
  if (newStatus === "draft") {
    patch.submitted_at = null;
  }

  const { error } = await supabase
    .from("ow_jobs")
    .update(patch)
    .eq("id", jobId)
    .eq("company_id", ctx1.companyId);

  if (error) {
    console.error("[jobs PATCH status]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Activity: job_published (best-effort, only on publish) — ctx1 を再利用
  if (newStatus === "published") {
    const jobRow1 = await supabase.from("ow_jobs").select("company_id, title").eq("id", jobId).maybeSingle();
    if (jobRow1.data?.company_id) {
      await insertActivity(supabase, {
        company_id: jobRow1.data.company_id,
        actor_user_id: ctx1.owUserId,
        type: "job_published",
        description: `求人「${jobRow1.data.title ?? "—"}」を公開しました`,
        target_type: "job",
        target_id: jobId,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 権限チェック: admin のみ求人を削除できる
  const cookieCompanyId2 = cookies().get("biz_current_company_id")?.value;
  const ctx2 = await getCompanyContext(supabase, user.id, cookieCompanyId2);
  if (!ctx2) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { requireAdmin(ctx2.allMemberships, ctx2.companyId); } catch { return permissionDeniedResponse(); }

  const { error } = await supabase
    .from("ow_jobs")
    .delete()
    .eq("id", jobId)
    .eq("company_id", ctx2.companyId);

  if (error) {
    console.error("[jobs DELETE]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
