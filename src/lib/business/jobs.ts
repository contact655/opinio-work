import type { SupabaseClient } from "@supabase/supabase-js";
import type { BizJob, JobStatus } from "./mockJobs";
import { VALID_JOB_EMPLOYMENT_TYPES, JOB_EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { VALID_REMOTE_WORK_STATUSES, REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

/**
 * 求人の「選択肢が決まっている項目」を検証する。**作成と更新の両方から呼ぶ。**
 *
 * ── なぜ（2026-08-07）──────────────────────────────────────────────────────
 * employment_type / remote_work_status / urgency はどれも
 * **API 側に検証が無く**、`str(v, 50)` で任意の文字列が通っていた。
 *   ・employment_type は DB の CHECK も無く、綴りがずれると
 *     エラーも出ずに保存され、一覧のフィルタから静かに消えた
 *   ・remote_work_status は CHECK があるので 23514 で落ちるが、
 *     フォームが日本語ラベルを送っていたため**選ぶと必ず保存に失敗**していた
 *   ・urgency は `=== "hot" ? "hot" : "open"` で、**不正値を黙って open に倒して**いた
 *
 * ⚠️ 空文字・未指定は「未入力」として通す。**不正値だけ 400 で返す。**
 *    黙って null や既定値に落とさない。
 *
 * @returns 問題があればエラー内容、無ければ null
 */
export function validateJobOptionFields(
  body: Record<string, unknown>,
): { error: string; message: string } | null {
  const blank = (v: unknown) => v === undefined || v === null || v === "";

  if (!blank(body.employmentType) && !VALID_JOB_EMPLOYMENT_TYPES.has(String(body.employmentType))) {
    return {
      error: "INVALID_EMPLOYMENT_TYPE",
      message: `雇用形態は次のいずれかです: ${JOB_EMPLOYMENT_TYPES.join(" / ")}`,
    };
  }
  if (!blank(body.remoteWorkStatus) && !VALID_REMOTE_WORK_STATUSES.has(String(body.remoteWorkStatus))) {
    return {
      error: "INVALID_REMOTE_WORK_STATUS",
      message: `勤務形態は次のいずれかです: ${REMOTE_WORK_STATUSES.map((o) => o.value).join(" / ")}`,
    };
  }
  if (!blank(body.urgency) && body.urgency !== "open" && body.urgency !== "hot") {
    return { error: "INVALID_URGENCY", message: "急募設定は open / hot のいずれかです。" };
  }
  return null;
}

/** urgency の保存値。空は既定の open、不正値は事前に 400 で弾いてある */
export function toUrgency(v: unknown): "open" | "hot" {
  return v === "hot" ? "hot" : "open";
}

// ─── Public types ──────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  gradient: string;
  initial: string;
};

export type JobRole = { roleId: string; isPrimary: boolean };

export type JobEditData = {
  job: BizJob;
  assigneeIds: string[];
  jobRoles: JobRole[];
  companyId: string;
};

// ─── DB row types ─────────────────────────────────────

type DbJobFull = {
  id: string;
  company_id: string | null;
  title: string | null;
  job_category: string | null;
  employment_type: string | null;
  department: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_note: string | null;
  location: string | null;
  remote_work_status: string | null;
  probation_period: string | null;
  description_markdown: string | null;
  message_to_candidates: string | null;
  required_skills: string[] | null;
  preferred_skills: string[] | null;
  culture_fit: string | null;
  selection_steps: string[] | null;
  selection_duration: string | null;
  start_date_preference: string | null;
  status: string | null;
  urgency: string | null;
  published_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  rejection_date: string | null;
  rejection_reviewer: string | null;
  business_model: string | null;
  // セールス職専用項目 (Migration 212)
  ote_min: number | null;
  ote_max: number | null;
  sales_segment: string[] | null;
  sales_hunter_farmer: string | null;
  incentive_note: string | null;
  // 技術スタック (Migration 245)
  tech_stack: string[] | null;
  ow_job_assignees: { user_id: string }[] | null;
};

// DbJob: migration 031 カラム名に統一 (旧: description/requirements/selection_process)
type DbJob = {
  id: string;
  title: string | null;
  job_category: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  remote_work_status: string | null;
  description_markdown: string | null;  // m031 (旧: description)
  required_skills: string[] | null;     // m031 TEXT[] (旧: requirements TEXT)
  preferred_skills: string[] | null;    // m031 TEXT[]
  selection_steps: string[] | null;     // m031 TEXT[] (旧: selection_process JSONB)
  status: string | null;
  urgency: string | null;
  published_at: string | null;
  updated_at: string | null;
  business_model: string | null;        // m210 業態タグ
};

// ─── Helpers ───────────────────────────────────────────

/**
 * DB から**読める** status。DB の CHECK（ow_jobs_status_check）と同じ5値。
 *
 * ⚠️ `active` は 2026-08-11 に削除した。migration 113 以前の旧値で、
 *    実データ0件・書き込み経路なし・published との違いを説明した記述も無かった。
 *    **復活させないこと。**
 */
const VALID_STATUSES = new Set<string>(["draft", "pending_review", "published", "rejected", "private"]);

/**
 * **企業側の API（`PATCH /api/biz/jobs/[id]`）が許す status の遷移。**
 * 「今どの状態か」→「そこから移ってよい状態」。
 *
 * ⚠️ **`published` はどこからも出てこない。これがこの表の目的。**
 *    公開にできるのは運営だけで、経路は `/admin/jobs` の `approveJob`
 *    （Server Action・admin クライアント）1本に限る。
 *    `rejected`（差し戻し）も同じく運営専用。
 *
 * ── なぜ遷移表にしたか（2026-08-23）────────────────────────────────────
 * それまでは「設定してよい値」の**平らな集合**（`SETTABLE_JOB_STATUSES`）で、
 * **`published` が入っていた。** 画面に公開ボタンは無かったが、
 * **企業の管理者が API を直接叩けば審査を経ずに公開できた。**
 * 唯一の歯止めは「その企業のページが公開済みか」だけだった。
 *
 * 値の集合では「どこから来たか」を見られないので、**遷移として持つ**。
 *
 * ⚠️ **中身は画面（`components/business/JobListCard.tsx` の `renderActions`）が
 *    出しているボタンと1対1。** 画面にボタンを足したらここにも足す。
 *    逆にここだけ広げると、画面に無い操作が API から通る状態に戻る。
 *
 * ⚠️ 遷移先を足すときは DB の CHECK（`ow_jobs_status_check`）と
 *    `VALID_STATUSES`（＝表示側）も見ること。3つ揃える（CLAUDE.md）。
 *
 * ⚠️ **この表はアプリ側の制限にすぎない。DB 側にも同じ規則が入っている**
 *    （2026-08-23 / `trg_guard_job_status`）。それまでは RLS が
 *    `FOR ALL` で開いており、**企業管理者が PostgREST を直接叩けば
 *    審査を経ずに公開できた**（実測で 204 を確認）。
 *    ⚠️ ここに値を足すときは、DB のトリガー
 *       `guard_job_status_transition()` の許容値も同時に直すこと。
 *       片方だけ足すと「画面では選べるが保存できない」になる。
 */
export const JOB_STATUS_TRANSITIONS: Record<string, readonly JobStatus[]> = {
  /** 下書き → 公開申請 */
  draft:          ["pending_review"],
  /** 審査待ち → 申請を取り下げる */
  pending_review: ["draft"],
  /** 差し戻し → 修正して再申請 */
  rejected:       ["pending_review"],
  /** 公開中 → 自社都合で止める（運営の `privateJob` とは別。企業も止められる） */
  published:      ["private"],
  /** 非公開 → 公開を再開（＝再審査に出す。直接 published には戻さない） */
  private:        ["pending_review"],
};

/** `from` から `to` へ企業側が動かしてよいか。知らない値は false（fail-closed）。 */
export function canCompanyTransition(from: string | null, to: string): boolean {
  if (!from) return false;
  const allowed = JOB_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(to);
}

function toJobStatus(s: string | null): JobStatus {
  if (!s) return "draft";
  if (VALID_STATUSES.has(s)) return s as JobStatus;
  return "draft";
}


function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

function computeCompletionPercent(row: DbJob): number {
  const fields = [
    row.title,
    row.job_category,
    row.employment_type,
    row.location,
    row.description_markdown,          // m031
    row.required_skills?.length ? row.required_skills[0] : null,   // m031
    row.preferred_skills?.length ? row.preferred_skills[0] : null, // m031
    row.salary_min != null ? String(row.salary_min) : null,
    row.salary_max != null ? String(row.salary_max) : null,
    row.selection_steps?.length ? row.selection_steps[0] : null,   // m031
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function transformJob(row: DbJob, meetingCount: number, applicationCount: number): BizJob {
  const status = toJobStatus(row.status);
  return {
    id: row.id,
    title: row.title ?? "(タイトル未設定)",
    jobCategory: row.job_category ?? "",
    employmentType: row.employment_type ?? "",
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    location: row.location ?? undefined,
    remoteWorkStatus: row.remote_work_status ?? undefined,
    descriptionMarkdown: row.description_markdown ?? undefined,    // m031 修正
    requiredSkills: row.required_skills ?? [],                     // m031 修正
    preferredSkills: row.preferred_skills ?? [],                   // m031 修正
    selectionSteps: row.selection_steps ?? [],                     // m031 修正
    businessModel: row.business_model ?? undefined,
    assigneeNames: [],
    status,
    meetingCount,
    applicationCount,
    urgency: (row.urgency as "open" | "hot") ?? "open",
    completionPercent: computeCompletionPercent(row),
    lastEditedAt: formatRelativeDate(row.updated_at),
    publishedAt: row.published_at ? formatRelativeDate(row.published_at) : undefined,
    submittedAt: undefined,
    rejectionReason: undefined,
    rejectionDate: undefined,
    rejectionReviewer: undefined,
  };
}

// ─── Public fetch ──────────────────────────────────────

export async function fetchJobsForCompany(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BizJob[]> {
  const { data: rows, error } = await supabase
    .from("ow_jobs")
    .select(
      "id, title, job_category, employment_type, salary_min, salary_max, location, remote_work_status, description_markdown, required_skills, preferred_skills, selection_steps, status, urgency, published_at, updated_at, business_model, department_id, ow_company_departments!department_id(name), ow_job_roles!job_id(role_id, ow_roles!role_id(name)), company_job_role_id, ow_company_job_roles!company_job_role_id(name, deleted_at)"
    )
    .eq("company_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[fetchJobsForCompany]", error.message);
    return [];
  }
  if (!rows?.length) return [];

  // Phase 2: count meetings and applications per job (parallel)
  const jobIds = rows.map((r) => r.id);
  const [{ data: meetingRows }, { data: applicationRows }] = await Promise.all([
    supabase
      .from("ow_casual_meetings")
      .select("job_id")
      .in("job_id", jobIds)
      .neq("status", "declined"),
    supabase
      .from("ow_job_applications")
      .select("job_id")
      .in("job_id", jobIds),
  ]);

  const meetingCounts: Record<string, number> = {};
  for (const m of meetingRows ?? []) {
    if (m.job_id) meetingCounts[m.job_id] = (meetingCounts[m.job_id] ?? 0) + 1;
  }
  const applicationCounts: Record<string, number> = {};
  for (const a of applicationRows ?? []) {
    if (a.job_id) applicationCounts[a.job_id] = (applicationCounts[a.job_id] ?? 0) + 1;
  }

  return rows.map((row) => {
    const r = row as unknown as DbJob & {
      department_id?: string | null;
      ow_company_departments?: { name: string } | null;
      ow_job_roles?: { role_id: string; ow_roles?: { name: string } | null }[] | null;
      ow_company_job_roles?: { name: string; deleted_at: string | null } | null;
    };
    const job = transformJob(r, meetingCounts[row.id] ?? 0, applicationCounts[row.id] ?? 0);
    job.departmentId = r.department_id ?? undefined;
    job.departmentName = r.ow_company_departments?.name ?? undefined;
    job.jobRoleNames = (r.ow_job_roles ?? [])
      .map((jr) => jr.ow_roles?.name)
      .filter((n): n is string => !!n);
    // 自社での呼び方。論理削除済みは出さない（会社が「もう使っていない」と言っている名前）
    job.companyRoleName = r.ow_company_job_roles?.deleted_at ? undefined : r.ow_company_job_roles?.name;
    return job;
  });
}

// ─── fetchJobById ──────────────────────────────────────

export async function fetchJobById(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobEditData | null> {
  const { data, error } = await supabase
    .from("ow_jobs")
    .select(
      "id, company_id, title, job_category, employment_type, department, salary_min, salary_max, salary_note, location, remote_work_status, probation_period, description_markdown, message_to_candidates, required_skills, preferred_skills, culture_fit, selection_steps, selection_duration, start_date_preference, status, urgency, published_at, updated_at, submitted_at, rejection_reason, rejection_date, rejection_reviewer, business_model, ote_min, ote_max, sales_segment, sales_hunter_farmer, incentive_note, tech_stack, ow_job_assignees!job_id(user_id)"
    )
    .eq("id", jobId)
    .single();

  if (error || !data) {
    console.error("[fetchJobById]", error?.message ?? "not found");
    return null;
  }

  const row = data as unknown as DbJobFull;
  const assigneeIds = (row.ow_job_assignees ?? []).map((a) => a.user_id);

  // ow_job_roles を別途ロード
  const { data: roleRows } = await supabase
    .from("ow_job_roles")
    .select("role_id, is_primary")
    .eq("job_id", data.id);
  const jobRoles: JobRole[] = (roleRows ?? []).map((r: { role_id: string; is_primary: boolean }) => ({
    roleId: r.role_id,
    isPrimary: r.is_primary,
  }));

  const job: BizJob = {
    id: row.id,
    title: row.title ?? "(タイトル未設定)",
    jobCategory: row.job_category ?? "",
    employmentType: row.employment_type ?? "",
    department: row.department ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    location: row.location ?? undefined,
    remoteWorkStatus: row.remote_work_status ?? undefined,
    descriptionMarkdown: row.description_markdown ?? undefined,
    messageToCandidates: row.message_to_candidates ?? undefined,
    requiredSkills: row.required_skills ?? [],
    preferredSkills: row.preferred_skills ?? [],
    cultureFit: row.culture_fit ?? undefined,
    selectionSteps: row.selection_steps ?? [],
    selectionDuration: row.selection_duration ?? undefined,
    startDatePreference: row.start_date_preference ?? undefined,
    assigneeNames: [],
    status: toJobStatus(row.status),
    meetingCount: 0,
    applicationCount: 0,
    urgency: (row.urgency as "open" | "hot") ?? "open",
    completionPercent: 0,
    lastEditedAt: formatRelativeDate(row.updated_at),
    publishedAt: row.published_at ? formatRelativeDate(row.published_at) : undefined,
    submittedAt: row.submitted_at ? formatRelativeDate(row.submitted_at) : undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    rejectionDate: row.rejection_date ?? undefined,
    rejectionReviewer: row.rejection_reviewer ?? undefined,
    businessModel: row.business_model ?? undefined,
    // セールス職専用項目 (Migration 212)
    oteMin: row.ote_min ?? undefined,
    oteMax: row.ote_max ?? undefined,
    salesSegment: row.sales_segment ?? undefined,
    salesHunterFarmer: row.sales_hunter_farmer ?? undefined,
    incentiveNote: row.incentive_note ?? undefined,
    techStack: row.tech_stack ?? [],
  };

  return { job, assigneeIds, jobRoles, companyId: row.company_id ?? "" };
}

// ─── fetchTeamMembers ──────────────────────────────────

export async function fetchTeamMembers(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TeamMember[]> {
  const { data: memberships, error } = await supabase
    .from("ow_company_admins")
    .select("permission, ow_users!inner(id, name, avatar_color)")
    .eq("company_id", tenantId)
    .eq("is_active", true);

  if (error || !memberships?.length) return [];

  return memberships
    .map((m) => {
      // avatar_initial は ow_users に存在しないため name[0] を使用
      const u = m.ow_users as unknown as { id: string; name: string | null; avatar_color: string | null } | null;
      if (!u) return null;
      return {
        id: u.id,
        name: u.name ?? "ユーザー",
        gradient: u.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))",
        initial: u.name?.[0] ?? "U",
        role: m.permission === "admin" ? "Admin · 採用管理者" : "採用担当",
      };
    })
    .filter((m): m is TeamMember => m !== null);
}
