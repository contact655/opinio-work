"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AdminActionResult } from "./createAdminPost";

export async function deleteAdminPost(id: string): Promise<AdminActionResult<null>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "管理者権限が必要です" };

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return { success: false, error: "管理者権限が必要です" };

  const { error } = await supabase
    .from("ow_company_external_links")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteAdminPost] error:", error);
    return { success: false, error: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin/posts");
  return { success: true, data: null };
}
