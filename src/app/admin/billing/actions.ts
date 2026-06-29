"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

export async function updateBillingStatus(
  applicationId: string,
  status: "unpaid" | "invoiced" | "paid"
): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { billing_status: status };
  if (status === "invoiced") updates.invoiced_at = now;
  if (status === "paid")     updates.paid_at     = now;
  await admin.from("ow_job_applications").update(updates).eq("id", applicationId);
  revalidatePath("/admin/billing");
}

export async function updateBillingNote(
  applicationId: string,
  note: string
): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("ow_job_applications").update({ billing_note: note.slice(0, 2000) }).eq("id", applicationId);
  revalidatePath("/admin/billing");
}
