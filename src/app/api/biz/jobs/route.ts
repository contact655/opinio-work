import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

function str(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.slice(0, max) || null : null;
}

function buildJobRecord(body: Record<string, unknown>, companyId: string) {
  const salaryMin = body.salaryMin ? parseInt(String(body.salaryMin)) : null;
  const salaryMax = body.salaryMax ? parseInt(String(body.salaryMax)) : null;
  return {
    company_id: companyId,
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
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(sourceId)) return NextResponse.json({ error: "Invalid sourceId" }, { status: 400 });
    const cookieCompanyIdDup = cookies().get("biz_current_company_id")?.value;
    const ctxDup = await getCompanyContext(supabase, user.id, cookieCompanyIdDup);
    if (!ctxDup) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    try { requireAdmin(ctxDup.allMemberships, ctxDup.companyId); } catch { return permissionDeniedResponse(); }

    const { data: source } = await supabase
      .from("ow_jobs")
      .select(
        "company_id, title, employment_type, job_category, department, salary_min, salary_max, salary_note, location, remote_work_status, probation_period, description_markdown, message_to_candidates, required_skills, preferred_skills, culture_fit, selection_steps, selection_duration, start_date_preference"
      )
      .eq("id", sourceId)
      .eq("company_id", ctxDup.companyId)
      .single();

    if (!source) return NextResponse.json({ error: "source job not found" }, { status: 404 });

    // 複製元が自社求人であることを明示検証
    if (source.company_id !== ctxDup.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
  // companyId を body から受け取るが、getCompanyContext で
  // ログインユーザーが そのテナントの管理者であることを明示検証する。
  const companyId = body.companyId as string | undefined;
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx || ctx.companyId !== companyId) {
    // ログインユーザーが指定 companyId の管理者でない
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  const record = buildJobRecord(body, companyId);
  const { data: newJob, error: insertErr } = await supabase
    .from("ow_jobs")
    .insert(record)
    .select("id")
    .single();

  if (insertErr || !newJob) {
    console.error("[jobs POST create]", insertErr?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const assigneeIds = Array.isArray(body.assigneeIds) ? (body.assigneeIds as string[]) : [];
  if (assigneeIds.length > 0) {
    // 担当者が自社メンバーであることを検証（PUT ハンドラーと同じ検証）
    const { data: validMembers } = await supabase
      .from("ow_company_admins")
      .select("user_id")
      .eq("company_id", ctx.companyId)
      .in("user_id", assigneeIds);
    const validIds = new Set((validMembers ?? []).map((m: { user_id: string }) => m.user_id));
    const safeAssignees = assigneeIds.filter((uid) => validIds.has(uid));
    if (safeAssignees.length > 0) {
      await supabase.from("ow_job_assignees").insert(
        safeAssignees.map((uid) => ({ job_id: newJob.id, user_id: uid }))
      );
    }
  }

  return NextResponse.json({ id: newJob.id });
}
