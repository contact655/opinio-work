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

/**
 * Server Action の戻り値。他の管理画面（admin/companies・admin/candidates）と揃える。
 * ⚠️ throw しないこと。呼び出し元はクリックハンドラなので、投げると
 *    unhandled rejection になって画面にもロールバックにも届かない。
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleAmbassador(adminId: string, value: boolean): Promise<ActionResult> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_company_admins")
    .update({ is_ambassador: value })
    .eq("id", adminId);

  if (error) {
    console.error("[toggleAmbassador]", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/biz-accounts");
  revalidatePath("/people");
  return { ok: true };
}
