import { createClient } from "@/lib/supabase/server";
import { mutateMany, mutateAllowNone } from "@/lib/supabase/mutate";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import { syncJobCategoryFromRoles } from "@/lib/business/deriveJobCategory";
import { syncCompanyJobRole } from "@/lib/business/companyJobRole";
import { validateJobOptionFields, toUrgency } from "@/lib/business/jobs";

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" ? v.slice(0, max) || undefined : undefined;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

function parseSalary(body: Record<string, unknown>): { salaryMin: number | null; salaryMax: number | null } | { error: string } {
  const salaryMin = body.salaryMin ? parseInt(String(body.salaryMin)) : null;
  const salaryMax = body.salaryMax ? parseInt(String(body.salaryMax)) : null;
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
    return { error: "最高給与は最低給与以上に設定してください" };
  }
  return { salaryMin, salaryMax };
}

function buildJobRecord(body: Record<string, unknown>, companyId: string, salaryMin: number | null, salaryMax: number | null) {
  return {
    company_id: companyId,
    title: str(body.title, 200) ?? "",
    employment_type: str(body.employmentType, 50),
    // job_category はクライアントから受け取らない。職種の正は ow_job_roles で、
    // この列は syncJobCategoryFromRoles が primary ロール名から派生させる。
    department: str(body.department, 100),
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_note: str(body.salaryNote, 200),
    location: str(body.location, 200),
    remote_work_status: str(body.remoteWorkStatus, 50),
    probation_period: str(body.probationPeriod, 100),
    work_hours: str(body.workHours, 200),
    holidays: str(body.holidays, 200),
    /* ⚠️ 正は `description`（2026-08-26 統合）。旧列に書くと求職者側に出ない。 */
    description: str(body.descriptionMarkdown, 50000),
    message_to_candidates: str(body.messageToCandidates, 2000),
    required_skills: strArr(body.requiredSkills),
    preferred_skills: strArr(body.preferredSkills),
    culture_fit: str(body.cultureFit, 2000),
    selection_steps: strArr(body.selectionSteps),
    selection_duration: str(body.selectionDuration, 100),
    start_date_preference: str(body.startDatePreference, 100),
    business_model: str(body.businessModel, 50) ?? null,
    // セールス職専用項目 (Migration 212)
    ote_min: body.oteMin ? parseInt(String(body.oteMin)) || null : null,
    ote_max: body.oteMax ? parseInt(String(body.oteMax)) || null : null,
    sales_segment: strArr(body.salesSegment).slice(0, 3),
    sales_hunter_farmer: str(body.salesHunterFarmer, 20) ?? null,
    incentive_note: str(body.incentiveNote, 1000) ?? null,
    tech_stack: strArr(body.techStack).slice(0, 40),
    /* ⚠️★2026-09-02 追加。**この3つは PUT にしか無く、新規作成の初回保存で落ちていた。**
          フォームは `currentJobId` が無いときだけ POST するので、
          「なぜ今採用するか」「チーム構成」「入社後90日」を書いてから
          「作成して続ける」を押すと、その3つだけが消える形だった。
       ⚠️ **POST と PUT は同じ項目を受けること。** 片方だけに足すと、
          新規作成と編集で保存される内容が変わる。 */
    why_hire: str(body.whyHire, 5000),
    team_composition: str(body.teamComposition, 5000),
    first_90_days: str(body.first90Days, 5000),
    /* ⚠️ 同上。`urgency`（採用温度感）と `department_id` も PUT にしか無く、
          新規作成時は DB の既定値になっていた。「HOT」を選んで作成しても `open` で入る。
       ⚠️ `toUrgency` は PUT と同じものを使う。ここで別の判定を書かない。 */
    urgency: toUrgency(body.urgency),
    department_id: (typeof body.departmentId === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.departmentId))
      ? body.departmentId : null,
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
        "company_id, title, employment_type, job_category, department, salary_min, salary_max, salary_note, location, remote_work_status, probation_period, description, message_to_candidates, required_skills, preferred_skills, culture_fit, selection_steps, selection_duration, start_date_preference"
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

  // 選択肢が決まっている項目は 400 で弾く。黙って既定値に倒さない
  const optionErr = validateJobOptionFields(body);
  if (optionErr) return NextResponse.json(optionErr, { status: 400 });

  const salaryResult = parseSalary(body);
  if ("error" in salaryResult) {
    return NextResponse.json({ error: salaryResult.error }, { status: 422 });
  }
  const record = buildJobRecord(body, companyId, salaryResult.salaryMin, salaryResult.salaryMax);
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
    const validIds = new Set((validMembers ?? []).filter((m): m is { user_id: string } => m.user_id != null).map((m) => m.user_id));
    const safeAssignees = assigneeIds.filter((uid) => validIds.has(uid));
    if (safeAssignees.length > 0) {
      await supabase.from("ow_job_assignees").insert(
        safeAssignees.map((uid) => ({ job_id: newJob.id, user_id: uid }))
      );
    }
  }

  /* ── ow_job_roles 同期 ──────────────────────────────────────────────────
     ⚠️ **職種の正は `ow_job_roles`。** `role_category_id` / `job_category` は
        主ロールからの**派生値**なので、**入れ替えが成功してから書く。**

     ⚠️ 2026-08-23 まで、失敗しても派生値だけ書く順序だった。
        当時 `ow_job_roles` には書き込みポリシーが1本も無く、
        **DELETE は黙って0行 / INSERT は 403** だったため、
        **職種の正だけが古いまま、派生値が新しくなる**形になっていた。
        `try/catch` で囲んであったが **supabase-js は例外を投げない**ので
        捕まっていない。 */
  const jobRoles = Array.isArray(body.jobRoles) ? body.jobRoles as { roleId: string; isPrimary: boolean }[] : [];
  if (jobRoles.length > 0) {
    // ⚠️ 新規作成なので消す対象は無い。RLS 拒否だけを見たいので AllowNone
    const del = await mutateAllowNone(
      supabase.from("ow_job_roles").delete().eq("job_id", newJob.id),
      "job POST: ow_job_roles 掃除",
      { returning: "job_id" },
    );
    const ins = del.ok
      ? await mutateMany(
          supabase.from("ow_job_roles").insert(
            jobRoles.map((r) => ({ job_id: newJob.id, role_id: r.roleId, is_primary: r.isPrimary }))
          ),
          "job POST: ow_job_roles 登録",
          { returning: "job_id" },
        )
      : del;

    if (ins.ok) {
      // job_category は primary ロール名から派生させる（移行期間中の表示用互換値）
      await syncJobCategoryFromRoles(supabase, newJob.id, jobRoles);
    } else {
      /* ⚠️ **派生値を書かない。** 書くと `ow_job_roles` と食い違う。
            求人自体は作成済みなので処理は続けるが、ログには必ず残す。 */
      console.error("[job POST] ow_job_roles の同期に失敗したため派生値を更新しない:", ins.error);
    }
  }

  // 「自社での呼び方」を ow_company_job_roles に溜めて ow_jobs から指す
  // ⚠️ 表示専用。検索・フィルタは標準職種（ow_job_roles）のまま
  await syncCompanyJobRole(supabase, {
    jobId: newJob.id,
    companyId: ctx.companyId,
    rawName: body.companyRoleName,
    jobRoles,
  });

  return NextResponse.json({ id: newJob.id });
}
