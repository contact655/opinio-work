import type { SupabaseClient } from "@supabase/supabase-js";
import type { BizJob, JobStatus } from "./mockJobs";

// ─── Public types ──────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  gradient: string;
  initial: string;
};

export type JobEditData = {
  job: BizJob;
  assigneeIds: string[];
};

// ─── DB row types ─────────────────────────────────────

type DbJobFull = {
  id: string;
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
  published_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  rejection_date: string | null;
  rejection_reviewer: string | null;
  ow_job_assignees: { user_id: string }[] | null;
};

type DbJob = {
  id: string;
  title: string | null;
  job_category: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  remote_work_status: string | null;
  description: string | null;
  requirements: string | string[] | null;
  preferred_skills: string | string[] | null;
  selection_process: string | string[] | null;
  status: string | null;
  published_at: string | null;
  updated_at: string | null;
};

// ─── Helpers ───────────────────────────────────────────

const VALID_STATUSES = new Set<string>(["draft", "pending_review", "published", "rejected", "private"]);

function toJobStatus(s: string | null): JobStatus {
  if (s && VALID_STATUSES.has(s)) return s as JobStatus;
  return "draft";
}

function toStringArray(v: string | string[] | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return v.split("\n").filter(Boolean);
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
    row.description,
    row.requirements,
    row.preferred_skills,
    row.salary_min != null ? String(row.salary_min) : null,
    row.salary_max != null ? String(row.salary_max) : null,
    row.selection_process,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function transformJob(row: DbJob, meetingCount: number): BizJob {
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
    descriptionMarkdown: row.description ?? undefined,
    requiredSkills: toStringArray(row.requirements),
    preferredSkills: toStringArray(row.preferred_skills),
    selectionSteps: toStringArray(row.selection_process),
    assigneeNames: [],
    status,
    meetingCount,
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
      "id, title, job_category, employment_type, salary_min, salary_max, location, remote_work_status, description, requirements, preferred_skills, selection_process, status, published_at, updated_at"
    )
    .eq("company_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[fetchJobsForCompany]", error.message);
    return [];
  }
  if (!rows?.length) return [];

  // Phase 2: count meetings per job (only non-declined)
  const jobIds = rows.map((r) => r.id);
  const { data: meetingRows } = await supabase
    .from("ow_casual_meetings")
    .select("job_id")
    .in("job_id", jobIds)
    .neq("status", "declined");

  const meetingCounts: Record<string, number> = {};
  for (const m of meetingRows ?? []) {
    if (m.job_id) meetingCounts[m.job_id] = (meetingCounts[m.job_id] ?? 0) + 1;
  }

  return rows.map((row) => transformJob(row as unknown as DbJob, meetingCounts[row.id] ?? 0));
}

// ─── fetchJobById ──────────────────────────────────────

export async function fetchJobById(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobEditData | null> {
  const { data, error } = await supabase
    .from("ow_jobs")
    .select(
      "id, title, job_category, employment_type, department, salary_min, salary_max, salary_note, location, remote_work_status, probation_period, description_markdown, message_to_candidates, required_skills, preferred_skills, culture_fit, selection_steps, selection_duration, start_date_preference, status, published_at, updated_at, submitted_at, rejection_reason, rejection_date, rejection_reviewer, ow_job_assignees!job_id(user_id)"
    )
    .eq("id", jobId)
    .single();

  if (error || !data) {
    console.error("[fetchJobById]", error?.message ?? "not found");
    return null;
  }

  const row = data as unknown as DbJobFull;
  const assigneeIds = (row.ow_job_assignees ?? []).map((a) => a.user_id);

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
    completionPercent: 0,
    lastEditedAt: formatRelativeDate(row.updated_at),
    publishedAt: row.published_at ? formatRelativeDate(row.published_at) : undefined,
    submittedAt: row.submitted_at ? formatRelativeDate(row.submitted_at) : undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    rejectionDate: row.rejection_date ?? undefined,
    rejectionReviewer: row.rejection_reviewer ?? undefined,
  };

  return { job, assigneeIds };
}

// ─── fetchTeamMembers ──────────────────────────────────

export async function fetchTeamMembers(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TeamMember[]> {
  const { data: roles, error } = await supabase
    .from("ow_user_roles")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error || !roles?.length) return [];

  const userIds = roles.map((r) => r.user_id);
  const { data: users } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, avatar_initial")
    .in("id", userIds);

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  return roles
    .map((r) => {
      const u = userMap[r.user_id];
      if (!u) return null;
      return {
        id: u.id as string,
        name: (u.name as string | null) ?? "ユーザー",
        gradient:
          (u.avatar_color as string | null) ??
          "linear-gradient(135deg, var(--royal), var(--accent))",
        initial:
          (u.avatar_initial as string | null) ??
          ((u.name as string | null)?.[0] ?? "U"),
        role: r.role === "admin" ? "Admin · 採用管理者" : "採用担当",
      };
    })
    .filter((m): m is TeamMember => m !== null);
}
