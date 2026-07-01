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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function approveJob(jobId: string): Promise<void> {
  if (!UUID_RE.test(jobId)) throw new Error("Invalid jobId");
  await assertAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from("ow_jobs").update({
    status: "published",
    published_at: now,
    updated_at: now,
    rejection_reason: null,
    rejection_reviewer: null,
    rejection_date: null,
  }).eq("id", jobId);
  revalidatePath("/admin/jobs");
}

export async function rejectJob(
  jobId: string,
  reason: string,
  reviewer: string,
): Promise<void> {
  if (!UUID_RE.test(jobId)) throw new Error("Invalid jobId");
  await assertAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const dateLabel = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  await admin.from("ow_jobs").update({
    status: "rejected",
    rejection_reason: reason.slice(0, 1000),
    rejection_reviewer: (reviewer || "OPINIO編集部").slice(0, 100),
    rejection_date: dateLabel,
    updated_at: now,
  }).eq("id", jobId);
  revalidatePath("/admin/jobs");
}

export async function privateJob(jobId: string): Promise<void> {
  if (!UUID_RE.test(jobId)) throw new Error("Invalid jobId");
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("ow_jobs").update({ status: "private", updated_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath("/admin/jobs");
}

export async function republishJob(jobId: string): Promise<void> {
  if (!UUID_RE.test(jobId)) throw new Error("Invalid jobId");
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("ow_jobs").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath("/admin/jobs");
}
