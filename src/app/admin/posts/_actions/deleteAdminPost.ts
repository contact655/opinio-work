"use server";

import { createClient } from "@/lib/supabase/server";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidatePath } from "next/cache";
import type { AdminActionResult } from "./createAdminPost";

export async function deleteAdminPost(id: string): Promise<AdminActionResult<null>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "管理者権限が必要です" };

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return { success: false, error: "管理者権限が必要です" };

  /* ⚠️ **0行削除を成功として扱わない**（CLAUDE.md）。RLS に弾かれても
        `error` は null で返るため、削除できていないのに成功と表示される。 */
  const res = await mutateOne(
    supabase.from("ow_company_external_links").delete().eq("id", id),
    "admin deleteAdminPost",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) {
    console.error("[deleteAdminPost] error:", error);
    return { success: false, error: "削除に失敗しました" };
  }

  revalidatePath("/admin/posts");
  return { success: true, data: null };
}
