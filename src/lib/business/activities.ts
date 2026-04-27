import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Write helper ────────────────────────────────────────

type ActivityPayload = {
  company_id: string;
  actor_user_id: string | null;
  type: string;
  description: string;
  target_type?: string;
  target_id?: string;
};

export async function insertActivity(
  supabase: SupabaseClient,
  payload: ActivityPayload,
): Promise<void> {
  try {
    const { error } = await supabase.from("ow_activities").insert(payload);
    if (error) console.warn("[ow_activities insert]", error.message);
  } catch (e) {
    console.warn("[ow_activities insert] unexpected:", e);
  }
}

// ─── Read helpers ────────────────────────────────────────

// Mirrors ActivityItem from ActivityList.tsx (structural match)
type ActivityType = "application" | "meeting_scheduled" | "message" | "job_published" | "offer";

export type DashboardActivity = {
  id: string;
  type: ActivityType;
  body: string;
  time: string;
};

const TYPE_MAP: Record<string, ActivityType> = {
  job_published:          "job_published",
  job_closed:             "job_published",
  meeting_status_changed: "meeting_scheduled",
  profile_updated:        "message",
  offer:                  "offer",
  application_received:   "application",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "今";
  if (h < 24) return `${h}h前`;
  const d = Math.floor(h / 24);
  if (d === 1) return "昨日";
  if (d < 7) return `${d}日前`;
  return `${Math.floor(d / 7)}週間前`;
}

export async function fetchActivitiesForDashboard(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 10,
): Promise<DashboardActivity[]> {
  try {
    const { data, error } = await supabase
      .from("ow_activities")
      .select("id, type, description, created_at")
      .eq("company_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[activities] fetch error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      type: TYPE_MAP[row.type as string] ?? "message",
      body: (row.description as string) ?? "",
      time: formatRelativeTime(row.created_at as string),
    }));
  } catch (err) {
    console.error("[activities] unexpected error:", err);
    return [];
  }
}
