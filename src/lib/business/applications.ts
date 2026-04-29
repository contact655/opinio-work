import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "interview"
  | "accepted"
  | "rejected";

export const VALID_APPLICATION_STATUSES = new Set<string>([
  "pending", "reviewing", "interview", "accepted", "rejected",
]);

export type ApplicationStatusTab = {
  status: ApplicationStatus | "all";
  label: string;
  labelJa: string;
  color: string;
};

export const APPLICATION_STATUS_TABS: ApplicationStatusTab[] = [
  { status: "all",       label: "All",       labelJa: "すべて",     color: "var(--ink-mute)" },
  { status: "pending",   label: "New",        labelJa: "新着",       color: "var(--warm)" },
  { status: "reviewing", label: "Reviewing",  labelJa: "確認中",     color: "var(--accent)" },
  { status: "interview", label: "Interview",  labelJa: "面接中",     color: "var(--purple)" },
  { status: "accepted",  label: "Accepted",   labelJa: "採用",       color: "var(--success)" },
  { status: "rejected",  label: "Rejected",   labelJa: "不採用",     color: "var(--error)" },
];

export type ApplicationStatusCounts = Record<ApplicationStatus | "all", number>;

export type BizApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: ApplicationStatus;
  createdAt: string;        // ISO string
  appliedAtLabel: string;   // 相対表示 ("今日", "3日前" 等)
};

// ─── DB row types ─────────────────────────────────────────────────────────

type DbApplication = {
  id: string;
  job_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
  ow_jobs: { id: string; title: string | null } | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function toApplicationStatus(s: string | null): ApplicationStatus {
  if (s && VALID_APPLICATION_STATUSES.has(s)) return s as ApplicationStatus;
  return "pending";
}

function formatRelativeDate(iso: string): string {
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

function transformApplication(row: DbApplication): BizApplication {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.ow_jobs?.title ?? "(求人情報なし)",
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: toApplicationStatus(row.status),
    createdAt: row.created_at,
    appliedAtLabel: formatRelativeDate(row.created_at),
  };
}

// ─── Public fetch ──────────────────────────────────────────────────────────

export async function fetchApplicationsForCompany(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BizApplication[]> {
  // RLS (migration 049 の company_admins_read_applications) で自社のみ返る
  // ただし eq("company_id") では ow_job_applications に company_id がないため
  // ow_jobs を経由して company_id でフィルタする
  const { data, error } = await supabase
    .from("ow_job_applications")
    .select(
      "id, job_id, name, email, phone, message, status, created_at, ow_jobs!inner(id, title)"
    )
    .eq("ow_jobs.company_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchApplicationsForCompany]", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    transformApplication(row as unknown as DbApplication)
  );
}

export function countByStatus(apps: BizApplication[]): ApplicationStatusCounts {
  const counts: ApplicationStatusCounts = {
    all: apps.length,
    pending: 0,
    reviewing: 0,
    interview: 0,
    accepted: 0,
    rejected: 0,
  };
  for (const a of apps) {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  }
  return counts;
}
