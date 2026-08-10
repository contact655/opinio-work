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
