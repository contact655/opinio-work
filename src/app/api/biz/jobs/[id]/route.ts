import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";
import { syncJobCategoryFromRoles } from "@/lib/business/deriveJobCategory";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" ? v.slice(0, max) || undefined : undefined;
}

const VALID_STATUSES = new Set(["draft", "pending_review", "published", "rejected", "private"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
    return NextResponse.json({ error: "最高給与は最低給与以上に設定してください" }, { status: 422 });
  }
  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("ow_jobs")
    .update({
      title: str(body.title, 200),
      employment_type: str(body.employmentType, 50),
      // job_category はクライアントから受け取らない。職種の正は ow_job_roles で、
      // この列は下の syncJobCategoryFromRoles が primary ロール名から派生させる。
      department: str(body.department, 100),
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_note: str(body.salaryNote, 200),
      location: str(body.location, 200),
      remote_work_status: str(body.remoteWorkStatus, 50),
      probation_period: str(body.probationPeriod, 100),
      description_markdown: str(body.descriptionMarkdown, 50000),
      message_to_candidates: str(body.messageToCandidates, 2000),
      required_skills: Array.isArray(body.requiredSkills) ? body.requiredSkills.filter((x: unknown): x is string => typeof x === "string").slice(0, 30).map((s: string) => s.slice(0, 200)) : [],
      preferred_skills: Array.isArray(body.preferredSkills) ? body.preferredSkills.filter((x: unknown): x is string => typeof x === "string").slice(0, 30).map((s: string) => s.slice(0, 200)) : [],
      culture_fit: str(body.cultureFit, 2000),
      selection_steps: Array.isArray(body.selectionSteps) ? body.selectionSteps.filter((x: unknown): x is string => typeof x === "string").slice(0, 20).map((s: string) => s.slice(0, 200)) : [],
      selection_duration: str(body.selectionDuration, 100),
      start_date_preference: str(body.startDatePreference, 100),
      urgency: (body.urgency === "hot") ? "hot" : "open",
      why_hire: str(body.whyHire, 5000),
      team_composition: str(body.teamComposition, 5000),
      first_90_days: str(body.first90Days, 5000),
      business_model: str(body.businessModel, 50) || null,
      // セールス職専用項目 (Migration 212)
      ote_min: body.oteMin ? parseInt(String(body.oteMin)) || null : null,
      ote_max: body.oteMax ? parseInt(String(body.oteMax)) || null : null,
      sales_segment: Array.isArray(body.salesSegment) ? (body.salesSegment as string[]).filter((s) => typeof s === "string").slice(0, 3) : null,
      sales_hunter_farmer: str(body.salesHunterFarmer, 20) || null,
      incentive_note: str(body.incentiveNote, 1000) || null,
      tech_stack: Array.isArray(body.techStack) ? (body.techStack as string[]).filter((s) => typeof s === "string").slice(0, 40) : [],
      department_id: (typeof body.departmentId === "string" && UUID_RE.test(body.departmentId)) ? body.departmentId : null,
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
  // 担当者削除は company_id による ownership 確認後にのみ実行
  const { count: jobCount } = await supabase.from("ow_jobs").select("id", { count: "exact", head: true }).eq("id", jobId).eq("company_id", ctx0.companyId);
  if (!jobCount) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  await supabase.from("ow_job_assignees").delete().eq("job_id", jobId);
  if (assigneeIds.length > 0) {
    const { data: validMembers } = await supabase
      .from("ow_company_admins")
      .select("user_id")
      .eq("company_id", ctx0.companyId)
      .in("user_id", assigneeIds);
    const validIds = new Set((validMembers ?? []).filter((m): m is { user_id: string } => m.user_id != null).map((m) => m.user_id));
    const safeAssigneeIds = assigneeIds.filter((uid: string) => validIds.has(uid));
    if (safeAssigneeIds.length > 0) {
      await supabase
        .from("ow_job_assignees")
        .insert(safeAssigneeIds.map((uid: string) => ({ job_id: jobId, user_id: uid })));
    }
  }

  // ow_job_roles 同期（best-effort）
  const jobRoles = Array.isArray(body.jobRoles) ? body.jobRoles as { roleId: string; isPrimary: boolean }[] : [];
  try {
    await supabase.from("ow_job_roles").delete().eq("job_id", jobId);
    if (jobRoles.length > 0) {
      await supabase.from("ow_job_roles").insert(
        jobRoles.map((r) => ({ job_id: jobId, role_id: r.roleId, is_primary: r.isPrimary }))
      );
      // job_category は primary ロール名から派生させる（移行期間中の表示用互換値）
      await syncJobCategoryFromRoles(supabase, jobId, jobRoles);
    }
  } catch { /* best-effort */ }

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
  if (!UUID_RE.test(jobId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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

  // 未承認企業は published への昇格不可
  if (newStatus === "published") {
    const { data: companyRow } = await supabase
      .from("ow_companies")
      .select("is_published")
      .eq("id", ctx1.companyId)
      .maybeSingle();
    if (companyRow && companyRow.is_published !== true) {
      return NextResponse.json(
        { error: "運営審査が完了するまで求人を公開できません" },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();
  const patch: { status: string; updated_at: string; submitted_at?: string | null } = { status: newStatus, updated_at: now };

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

      // Feed: job_posted (best-effort, 重複は 23505 で無視)
      try {
        const adminSupabase = createAdminClient();
        const coRow = await adminSupabase.from("ow_companies").select("name, brand_name").eq("id", jobRow1.data.company_id).maybeSingle();
        const coName = coRow.data?.brand_name ?? coRow.data?.name ?? "";
        const title = jobRow1.data.title ?? "—";
        const { error: feedErr } = await adminSupabase.from("ow_posts").insert({
          user_id: SYSTEM_USER_ID,
          post_type: "job_posted",
          ref_job_id: jobId,
          ref_company_id: jobRow1.data.company_id,
          content: `${coName}が「${title}」の募集を開始しました。`,
        });
        if (feedErr && feedErr.code !== "23505") {
          console.error("[feed job_posted]", feedErr.message);
        }
      } catch (feedErr) {
        console.error("[feed job_posted]", feedErr);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  if (!UUID_RE.test(jobId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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
