"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/* ★運営かどうかを各操作の中で確かめる（2026-10-10）。
      ⚠️ それまでこのファイルには判定が1つも無く、admin クライアントで書いていた。
         守っていたのは /admin の layout と middleware だけで、server action は呼び出し元のページに
         頼らず実行されうるので、ここで止める（他の admin の actions と同じ形）。 */
async function assertAdmin(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "ログインが必要です";
  const { data: isAdmin, error } = await supabase.rpc("auth_is_admin");
  if (error) console.error("[admin/placements] auth_is_admin:", error.message);
  return isAdmin === true ? null : "権限がありません";
}

export async function createPlacement(fd: FormData) {
  const denied = await assertAdmin();
  if (denied) return { error: denied };
  const admin = createAdminClient();
  const payload = buildPayload(fd);
  const { error } = await admin.from("ow_placements").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/placements");
  return { error: null };
}

export async function updatePlacement(id: string, fd: FormData) {
  const denied = await assertAdmin();
  if (denied) return { error: denied };
  const admin = createAdminClient();
  const payload = buildPayload(fd);
  const { error } = await admin.from("ow_placements").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/placements");
  return { error: null };
}

export async function deletePlacement(id: string) {
  const denied = await assertAdmin();
  if (denied) return { error: denied };
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
