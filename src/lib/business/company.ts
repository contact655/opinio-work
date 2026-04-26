import type { SupabaseClient } from "@supabase/supabase-js";
import type { BizCompany } from "./mockCompany";

export type DbCompany = {
  id: string;
  user_id: string | null;
  name: string;
  mission: string | null;
  industry: string | null;
  phase: string | null;
  business_stage: string | null;
  url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
  about_markdown: string | null;
  employee_count: string | null;
  established_at: string | null;
  avg_age: number | null;
  gender_ratio: string | null;
  evaluation_system: string | null;
  benefits: string[] | null;
  location: string | null;
  nearest_station: string | null;
  remote_work_status: string | null;
  work_time_system: string | null;
  avg_overtime_hours: string | null;
  paid_leave_rate: number | null;
  workstyle_description: string | null;
  is_published: boolean;
  accepting_casual_meetings: boolean;
  notification_emails: string[] | null;
  published_at: string | null;
  draft_data: Record<string, unknown> | null;
  updated_at: string | null;
};

const SELECT_COLUMNS = [
  "id", "user_id", "name", "mission", "industry", "phase", "business_stage", "url",
  "logo_gradient", "logo_letter", "about_markdown", "employee_count", "established_at",
  "avg_age", "gender_ratio", "evaluation_system", "benefits", "location", "nearest_station",
  "remote_work_status", "work_time_system", "avg_overtime_hours", "paid_leave_rate",
  "workstyle_description", "is_published", "accepting_casual_meetings", "notification_emails",
  "published_at", "draft_data", "updated_at",
].join(", ");

function formatPublishedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatPublishedAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

export function transformDbToForm(row: DbCompany): BizCompany {
  return {
    name: row.name ?? "",
    mission: row.mission ?? "",
    industry: row.industry ?? "",
    phase: row.phase ?? row.business_stage ?? "",
    url: row.url ?? "",
    logoGradient: row.logo_gradient ?? "linear-gradient(135deg, var(--royal), var(--accent))",
    logoLetter: row.logo_letter ?? (row.name ? row.name[0] : "?"),
    descriptionMarkdown: row.about_markdown ?? "",
    employeeCount: row.employee_count ?? "",
    foundedAt: row.established_at ?? "",
    avgAge: row.avg_age != null ? String(row.avg_age) : "",
    genderRatio: row.gender_ratio ?? "",
    evaluationSystem: row.evaluation_system ?? "",
    benefitsTags: Array.isArray(row.benefits) ? row.benefits : [],
    location: row.location ?? "",
    nearestStation: row.nearest_station ?? "",
    remoteWorkStatus: row.remote_work_status ?? "",
    workScheduleType: row.work_time_system ?? "",
    avgOvertimeHours: row.avg_overtime_hours ?? "",
    paidLeaveRate: row.paid_leave_rate != null ? String(row.paid_leave_rate) : "",
    workstyleNote: row.workstyle_description ?? "",
    // TODO: next session — fetch from ow_company_photos + Supabase Storage
    photos: [],
    isPublished: row.is_published ?? false,
    acceptingCasualMeetings: row.accepting_casual_meetings ?? true,
    notificationEmails: Array.isArray(row.notification_emails)
      ? row.notification_emails.join(", ")
      : "",
    lastPublishedAt: formatPublishedAt(row.published_at),
    lastPublishedAgo: formatPublishedAgo(row.published_at),
    hasDraftChanges: row.draft_data != null && Object.keys(row.draft_data).length > 0,
  };
}

export function transformFormToDb(form: BizCompany): Record<string, unknown> {
  const avgAge = parseInt(form.avgAge.replace(/[^\d]/g, ""), 10);
  const paidLeave = parseInt(form.paidLeaveRate.replace(/[^\d]/g, ""), 10);
  return {
    name: form.name,
    mission: form.mission || null,
    industry: form.industry || null,
    phase: form.phase || null,
    url: form.url || null,
    logo_gradient: form.logoGradient || null,
    logo_letter: form.logoLetter || null,
    about_markdown: form.descriptionMarkdown || null,
    employee_count: form.employeeCount || null,
    established_at: form.foundedAt || null,
    avg_age: isNaN(avgAge) ? null : avgAge,
    gender_ratio: form.genderRatio || null,
    evaluation_system: form.evaluationSystem || null,
    benefits: form.benefitsTags.length > 0 ? form.benefitsTags : null,
    location: form.location || null,
    nearest_station: form.nearestStation || null,
    remote_work_status: form.remoteWorkStatus || null,
    work_time_system: form.workScheduleType || null,
    avg_overtime_hours: form.avgOvertimeHours || null,
    paid_leave_rate: isNaN(paidLeave) ? null : paidLeave,
    workstyle_description: form.workstyleNote || null,
    is_published: form.isPublished,
    accepting_casual_meetings: form.acceptingCasualMeetings,
    notification_emails: form.notificationEmails
      ? form.notificationEmails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)
      : null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchCompanyForTenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<BizCompany | null> {
  const { data, error } = await supabase
    .from("ow_companies")
    .select(SELECT_COLUMNS)
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[company] fetchCompanyForTenant error:", error.message);
    return null;
  }
  if (!data) return null;

  return transformDbToForm(data as unknown as DbCompany);
}
