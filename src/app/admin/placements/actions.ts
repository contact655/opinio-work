"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createPlacement(fd: FormData) {
  const admin = createAdminClient();
  const payload = buildPayload(fd);
  const { error } = await admin.from("ow_placements").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/placements");
  return { error: null };
}

export async function updatePlacement(id: string, fd: FormData) {
  const admin = createAdminClient();
  const payload = buildPayload(fd);
  const { error } = await admin.from("ow_placements").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/placements");
  return { error: null };
}

export async function deletePlacement(id: string) {
  const admin = createAdminClient();
  await admin.from("ow_placements").delete().eq("id", id);
  revalidatePath("/admin/placements");
  return { error: null };
}

function buildPayload(fd: FormData) {
  return {
    candidate_id: fd.get("candidate_id") as string,
    company_id: fd.get("company_id") as string,
    job_id: (fd.get("job_id") as string) || null,
    joined_at: fd.get("joined_at") as string,
    channel: fd.get("channel") as string,
    annual_salary: fd.get("annual_salary") ? Number(fd.get("annual_salary")) : null,
    fee_amount: fd.get("fee_amount") ? Number(fd.get("fee_amount")) : null,
    resigned_at: (fd.get("resigned_at") as string) || null,
    resignation_reason: (fd.get("resignation_reason") as string) || null,
  };
}
