import { laborToRow } from "@/lib/jobs/laborTerms";
import { requestPublish } from "@/lib/jobs/publishServer";
import { COMPANY_NOT_LISTED_MESSAGE, blockedMessage } from "@/lib/jobs/publishGate";
import { wordingMessage } from "@/lib/jobs/wordingCheck";
import { jobState, JOB_STATE_LABEL } from "@/lib/jobs/jobState";
import { createClient } from "@/lib/supabase/server";
import { mutateMany, mutateAllowNone } from "@/lib/supabase/mutate";
import { NextResponse } from "next/server";
import { revalidateJobPages } from "@/lib/companies/revalidate";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";
import { syncJobCategoryFromRoles } from "@/lib/business/deriveJobCategory";
import { syncCompanyJobRole } from "@/lib/business/companyJobRole";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import { validateJobOptionFields, toUrgency, canCompanyTransition, JOB_STATUS_TRANSITIONS } from "@/lib/business/jobs";


function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" ? v.slice(0, max) || undefined : undefined;
}

/* ⚠️ status の許容値はここに直書きしない。
   DB の CHECK は `active` を含む6値（旧データの温存）、
   API から設定できるのはそれを除く5値。lib/business/jobs.ts に並べてある。 */

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

  // 選択肢が決まっている項目は 400 で弾く。黙って既定値に倒さない
  const optionErr = validateJobOptionFields(body);
  if (optionErr) return NextResponse.json(optionErr, { status: 400 });

  /* ★労働条件（2026-10-11）。⚠️ 送られてこなければ触らない（「送られてこない＝変更しない」） */
  const labor = body.laborTerms !== undefined ? laborToRow(body.laborTerms) : null;
  if (labor && "error" in labor) return NextResponse.json({ error: labor.error }, { status: 400 });

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("ow_jobs")
    .update({
      title: str(body.title, 200),
      employment_type: str(body.employmentType, 50),
      // job_category はクライアントから受け取らない。職種の正は ow_job_roles で、
      // この列は下の syncJobCategoryFromRoles が primary ロール名から派生させる。
      department: str(body.department, 100),
      salary_min: body.salaryNegotiable === true ? null : salaryMin,
      salary_max: body.salaryNegotiable === true ? null : salaryMax,
      /* ★要相談（2026-10-10）。⚠️ 送られてこなければ触らない。要相談なら金額は持たない（DB の CHECK も同じ） */
      ...(typeof body.salaryNegotiable === "boolean" ? { salary_negotiable: body.salaryNegotiable } : {}),
      salary_note: str(body.salaryNote, 200),
      location: str(body.location, 200),
      remote_work_status: str(body.remoteWorkStatus, 50),
      probation_period: str(body.probationPeriod, 100),
      work_hours: str(body.workHours, 200),
      holidays: str(body.holidays, 200),
      /* ⚠️ 正は `description`（2026-08-26 統合）。旧列に書くと求職者側に出ない。 */
      description: str(body.descriptionMarkdown, 50000),
      message_to_candidates: str(body.messageToCandidates, 2000),
      required_skills: Array.isArray(body.requiredSkills) ? body.requiredSkills.filter((x: unknown): x is string => typeof x === "string").slice(0, 30).map((s: string) => s.slice(0, 200)) : [],
      preferred_skills: Array.isArray(body.preferredSkills) ? body.preferredSkills.filter((x: unknown): x is string => typeof x === "string").slice(0, 30).map((s: string) => s.slice(0, 200)) : [],
      culture_fit: str(body.cultureFit, 2000),
      selection_steps: Array.isArray(body.selectionSteps) ? body.selectionSteps.filter((x: unknown): x is string => typeof x === "string").slice(0, 20).map((s: string) => s.slice(0, 200)) : [],
      selection_duration: str(body.selectionDuration, 100),
      start_date_preference: str(body.startDatePreference, 100),
      urgency: toUrgency(body.urgency),
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
      ...(labor ? labor.row : {}),
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
  /* ⚠️ 入れ替え前の掃除。**0行は正常**（担当者が元から居ない）が、
        RLS 拒否は 0行と区別する（mutateAllowNone は error を見る）。 */
  const delAssignees = await mutateAllowNone(
    supabase.from("ow_job_assignees").delete().eq("job_id", jobId),
    "job PUT: 担当者の掃除",
    { returning: "job_id" },
  );
  if (!delAssignees.ok) {
    console.error("[job PUT] 担当者の削除に失敗:", delAssignees.error);
  }
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

  /* ── ow_job_roles 同期 ──────────────────────────────────────────────────
     ⚠️ **職種の正は `ow_job_roles`。** `role_category_id` / `job_category` は
        主ロールからの**派生値**なので、**入れ替えが成功してから書く。**
        経緯は POST 側（api/biz/jobs/route.ts）の同じ箇所のコメントを参照。 */
  const jobRoles = Array.isArray(body.jobRoles) ? body.jobRoles as { roleId: string; isPrimary: boolean }[] : [];
  {
    // ⚠️ 職種が0件になることもある（全部外した）。掃除だけなら0行でよい
    const del = await mutateAllowNone(
      supabase.from("ow_job_roles").delete().eq("job_id", jobId),
      "job PUT: ow_job_roles 掃除",
      { returning: "job_id" },
    );
    if (!del.ok) {
      console.error("[job PUT] ow_job_roles の削除に失敗:", del.error);
    } else if (jobRoles.length > 0) {
      const ins = await mutateMany(
        supabase.from("ow_job_roles").insert(
          jobRoles.map((r) => ({ job_id: jobId, role_id: r.roleId, is_primary: r.isPrimary }))
        ),
        "job PUT: ow_job_roles 登録",
        { returning: "job_id" },
      );
      if (ins.ok) {
        // job_category は primary ロール名から派生させる（移行期間中の表示用互換値）
        await syncJobCategoryFromRoles(supabase, jobId, jobRoles);
      } else {
        /* ⚠️ **派生値を書かない。** 書くと `ow_job_roles` と食い違う。 */
        console.error("[job PUT] ow_job_roles の登録に失敗したため派生値を更新しない:", ins.error);
      }
    }
  }

  // 「自社での呼び方」を ow_company_job_roles に溜めて ow_jobs から指す
  // ⚠️ 表示専用。検索・フィルタは標準職種（ow_job_roles）のまま
  await syncCompanyJobRole(supabase, {
    jobId,
    companyId: ctx0.companyId,
    rawName: body.companyRoleName,
    jobRoles,
  });

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

  /* ⚠️★2026-09-08 追加。このファイルには revalidate が1つも無く、企業が求人を
        編集・公開・削除しても、`/jobs`・求人詳細・**その企業の企業ページ**は
        ページの `revalidate` 待ちだった。slug の扱いは revalidateJobPages に集約。 */
  await revalidateJobPages(jobId);
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

  /* ── 遷移の検査（2026-08-23）──────────────────────────────────────────
     ⚠️ **「設定してよい値か」ではなく「今の状態から移ってよいか」で見る。**
        以前は平らな集合で判定しており `published` が含まれていたため、
        **企業の管理者が API を直接叩けば審査を経ずに公開できた**
        （画面に公開ボタンは無いので、画面を見ている限り気づけない）。

     ⚠️ **現在の status を DB から読むこと。** リクエストの値を信じない。
        自社の求人であることは `company_id` の一致で確かめる
        （UPDATE 側の `.eq("company_id", ...)` と二重になるが、
         ここで弾かないと他社の求人の状態を**読めて**しまう）。 */
  const { data: current, error: curErr } = await supabase
    .from("ow_jobs")
    .select("status")
    .eq("id", jobId)
    .eq("company_id", ctx1.companyId)
    .maybeSingle();

  /* ⚠️ error を握り潰さない（CLAUDE.md）。読めなかったのか、
        他社の求人だったのかを区別できないので、どちらも 404 に倒す
        （存在の有無を漏らさない）。 */
  if (curErr) {
    console.error("[jobs PATCH status] 現在の status 取得に失敗:", curErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }

  if (!canCompanyTransition(current.status, newStatus)) {
    /* ⚠️ 何が悪いのかを案内する。「invalid status」だけだと企業側は分からない */
    /* ⚠️ DB の値（pending_review など）を企業に見せない。画面の呼び方（lib/jobs/jobState.ts）で書く */
    const hint = current.status === "pending_review"
      ? "再開を依頼済みです。OPINIO 運営の確認が済むまで変更できません。"
      : `いまの状態（${JOB_STATE_LABEL[jobState({ status: current.status, stoppedAt: null })]}）からは、この操作はできません。`;
    return NextResponse.json({ error: hint, allowed: JOB_STATUS_TRANSITIONS[current.status ?? ""] ?? [] }, { status: 403 });
  }

  /* ★「公開する」「再開する」「再開を依頼する」（2026-10-12 / 柴さんの指示。即時公開）。
        ⚠️ 判定と書き込みは lib/jobs/publishServer.ts の requestPublish だけ（画面と同じ判定 decidePublish）。
           17項目が欠けている・禁止表現・企業ページが公開中でない → 断る ／
           運営が停止した求人 → 再開の依頼（pending_review）／ それ以外（自社で停止した求人を含む）→ すぐ公開
        ⚠️ 企業が直接 published を書けないこと（トリガー・RLS）は変えていない。書き込みは admin クライアント */
  if (newStatus === "published") {
    const r = await requestPublish(jobId, ctx1.companyId, ctx1.owUserId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const d = r.decision;
    if (d.kind === "blocked") {
      if (d.reason === "company_not_listed") {
        return NextResponse.json({ error: COMPANY_NOT_LISTED_MESSAGE, decision: "blocked", reason: "company_not_listed" }, { status: 409 });
      }
      /* ★必要な項目の不足と禁止表現は同じ扱い（422）。文は blockedMessage（「『営業マン』は使えません…」） */
      return NextResponse.json(
        { error: blockedMessage(d), decision: "blocked", reason: d.reason,
          missing: d.missing.map((m) => ({ key: m.key, label: m.label })),
          hits: d.hits.map((h) => ({ match: h.match, field: h.field, message: wordingMessage(h) })) },
        { status: 422 },
      );
    }
    if (d.kind === "review") {
      return NextResponse.json({ ok: true, decision: "review", reason: d.reason });
    }
    return NextResponse.json({ ok: true, decision: "published" });
  }

  const now = new Date().toISOString();
  const patch: { status: string; updated_at: string; submitted_at?: string | null } = { status: newStatus, updated_at: now };
  /* ⚠️ ここに来るのは「停止する」（published → private）だけ（JOB_STATUS_TRANSITIONS）。自社での停止は停止の記録（stopped_*）を付けない */
  const { error } = await supabase
    .from("ow_jobs")
    .update(patch)
    .eq("id", jobId)
    .eq("company_id", ctx1.companyId);
  if (error) {
    console.error("[jobs PATCH status]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  await revalidateJobPages(jobId);
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

  /* ⚠️★**削除する前に slug を控える**（2026-09-08）。消してから引いても行が無いので、
        **消した求人のページ（`/jobs/<slug>`）がキャッシュに残り続ける。** */
  const before = await supabase
    .from("ow_jobs").select("slug").eq("id", jobId).eq("company_id", ctx2.companyId).maybeSingle();

  const { error } = await supabase
    .from("ow_jobs")
    .delete()
    .eq("id", jobId)
    .eq("company_id", ctx2.companyId);

  if (error) {
    /* ★提案に添えた求人は消せない（2026-10-11。ow_proposals.job_id は ON DELETE RESTRICT。
          消すと、提案から始まった会話の「開いてよい理由」まで消えるため）。
          ⚠️★**理由（提案に使われていること）を文言に書かない**（2026-10-11 / 柴さんの判断）。
             書くと、その求人で誰かに貴社を紹介したことが企業に分かる */
    if (error.code === "23503") {
      return NextResponse.json({ error: "この求人は削除できません。停止してください。" }, { status: 409 });
    }
    console.error("[jobs DELETE]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /* ⚠️★2026-09-08 追加。このファイルには revalidate が1つも無く、企業が求人を
        編集・公開・削除しても、`/jobs`・求人詳細・**その企業の企業ページ**は
        ページの `revalidate` 待ちだった。 */
  await revalidateJobPages(jobId, { slug: before.data?.slug ?? null, companyId: ctx2.companyId });
  return NextResponse.json({ ok: true });
}
