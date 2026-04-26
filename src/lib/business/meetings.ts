import type { MeetingApplication, MeetingStatus } from "@/lib/business/mockMeetings";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createClient>;

// ─── DB row types ────────────────────────────────────────

type DbApplicant = {
  id: string;
  name: string;
  avatar_color: string | null;
  age_range: string | null;
};

type DbJob = {
  id: string;
  title: string;
  salary_min: number | null;
  salary_max: number | null;
};

type DbAssignee = {
  id: string;
  name: string;
  avatar_color: string | null;
};

type DbExperience = {
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  display_order: number;
  company: { name: string } | null;
};

type DbMeeting = {
  id: string;
  intent: string | null;
  interest_reason: string | null;
  questions: string | null;
  preferred_format: string | null;
  company_internal_memo: string | null;
  company_read_at: string | null;
  assignee_user_id: string | null;
  created_at: string;
  job_id: string | null;
  status: string;
  applicant: DbApplicant | null;
  job: DbJob | null;
  assignee: DbAssignee | null;
};

// ─── Constants ───────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  info_gathering: "情報収集中",
  good_opportunity: "良い機会があれば検討",
  within_6: "積極的に転職検討中",
  within_3: "積極的に転職検討中",
};

const GRADIENTS = [
  "linear-gradient(135deg, var(--royal), var(--accent))",
  "linear-gradient(135deg, #FBBF24, #D97706)",
  "linear-gradient(135deg, #34D399, #059669)",
  "linear-gradient(135deg, #A78BFA, #7C3AED)",
  "linear-gradient(135deg, #DB2777, #9D174D)",
  "linear-gradient(135deg, #0EA5E9, #0369A1)",
  "linear-gradient(135deg, #F97316, #C2410C)",
];

// ─── Helpers ─────────────────────────────────────────────

function generateGradient(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

function resolveCompanyName(exp: DbExperience): string {
  if (exp.company?.name) return exp.company.name;
  if (exp.company_text) return exp.company_text;
  if (exp.company_anonymized) return exp.company_anonymized;
  return "—";
}

function formatPeriod(start: string, end: string | null, isCurrent: boolean): string {
  const s = start.slice(0, 7).replace("-", ".");
  if (isCurrent) return `${s} — 現在`;
  const e = end ? end.slice(0, 7).replace("-", ".") : "—";
  return `${s} — ${e}`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return "今";
  if (diffH < 24) return `${diffH}h前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "昨日";
  if (diffD < 7) return `${diffD}日前`;
  if (diffD < 30) return `${Math.floor(diffD / 7)}週間前`;
  return `${Math.floor(diffD / 30)}ヶ月前`;
}

// ─── Transform ───────────────────────────────────────────

export function transformMeeting(
  row: DbMeeting,
  experiencesByUser: Map<string, DbExperience[]>
): MeetingApplication {
  const applicant = row.applicant;
  const exps = experiencesByUser.get(applicant?.id ?? "") ?? [];
  const sorted = [...exps].sort(
    (a, b) =>
      (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0) ||
      a.display_order - b.display_order
  );
  const currentExp = sorted[0] ?? null;

  const applicantGradient =
    (applicant?.avatar_color && applicant.avatar_color.startsWith("linear-gradient"))
      ? applicant.avatar_color
      : generateGradient(row.id);

  const assigneeGradient = row.assignee?.avatar_color?.startsWith("linear-gradient")
    ? row.assignee.avatar_color
    : row.assignee_user_id
    ? generateGradient(row.assignee_user_id)
    : null;

  return {
    id: row.id,
    applicantName: applicant?.name ?? "—",
    applicantInitial: applicant?.name?.charAt(0) ?? "?",
    applicantGradient,
    applicantAge: applicant?.age_range ?? "—",
    applicantCurrentCompany: currentExp ? resolveCompanyName(currentExp) : "—",
    applicantCurrentRole: currentExp?.role_title ?? "—",
    jobTitle: row.job?.title ?? null,
    jobSalary:
      row.job?.salary_min != null && row.job?.salary_max != null
        ? `¥${row.job.salary_min}-${row.job.salary_max}万`
        : null,
    intent: INTENT_LABELS[row.intent ?? ""] ?? row.intent ?? "—",
    intentDetail: "",
    interestReason: row.interest_reason ?? "",
    questions: row.questions ?? "",
    preferredFormat: row.preferred_format ?? "—",
    submittedAt: formatRelativeTime(row.created_at),
    status: row.status as MeetingStatus,
    isUnread: row.company_read_at == null,
    assigneeId: row.assignee_user_id ?? null,
    assigneeName: row.assignee?.name ?? null,
    assigneeInitial: row.assignee?.name?.charAt(0) ?? null,
    assigneeGradient,
    companyMemo: row.company_internal_memo ?? "",
    career: sorted.map((e) => ({
      period: formatPeriod(e.started_at, e.ended_at, e.is_current),
      role: e.role_title ?? "—",
      company: resolveCompanyName(e),
      isCurrent: e.is_current,
    })),
  };
}

// ─── Main fetch ──────────────────────────────────────────

export async function fetchMeetingsForCompany(
  supabase: SupabaseClient,
  tenantId: string
): Promise<MeetingApplication[]> {
  try {
    // Step 1: meetings + applicant / job / assignee
    const { data: rows, error } = await supabase
      .from("ow_casual_meetings")
      .select(
        `id, intent, interest_reason, questions, preferred_format,
         company_internal_memo, company_read_at, assignee_user_id,
         created_at, job_id, status,
         applicant:ow_users!user_id (id, name, avatar_color, age_range),
         job:ow_jobs!job_id (id, title, salary_min, salary_max),
         assignee:ow_users!assignee_user_id (id, name, avatar_color)`
      )
      .eq("company_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[meetings] Step 1 query error:", error.message);
      return [];
    }

    if (!rows?.length) return [];

    // Step 2: experiences for all applicant user IDs
    const userIds = Array.from(
      new Set(
        rows
          .map((r) => (r.applicant as unknown as DbApplicant | null)?.id)
          .filter((id): id is string => !!id)
      )
    );

    const { data: exps, error: expError } = await supabase
      .from("ow_experiences")
      .select(
        `user_id, company_id, company_text, company_anonymized,
         role_title, started_at, ended_at, is_current, display_order,
         company:ow_companies!company_id (name)`
      )
      .in("user_id", userIds);

    if (expError) {
      console.error("[meetings] Step 2 experiences error:", expError.message);
    }

    // Build Map<userId, DbExperience[]>
    const expMap = new Map<string, DbExperience[]>();
    for (const e of (exps ?? []) as unknown as DbExperience[]) {
      if (!expMap.has(e.user_id)) expMap.set(e.user_id, []);
      expMap.get(e.user_id)!.push(e);
    }

    return (rows as unknown as DbMeeting[]).map((r) => transformMeeting(r, expMap));
  } catch (err) {
    console.error("[meetings] fetchMeetingsForCompany unexpected error:", err);
    return [];
  }
}
