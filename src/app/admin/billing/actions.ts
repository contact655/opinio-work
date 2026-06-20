"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateBillingStatus(
  applicationId: string,
  status: "unpaid" | "invoiced" | "paid"
): Promise<void> {
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
  const admin = createAdminClient();
  await admin.from("ow_job_applications").update({ billing_note: note }).eq("id", applicationId);
  revalidatePath("/admin/billing");
}
