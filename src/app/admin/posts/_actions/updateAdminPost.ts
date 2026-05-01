"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AdminActionResult } from "./createAdminPost";

type UpdateData = {
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
  published_at: string | null;
  type: string;
};

export async function updateAdminPost(
  id: string,
  data: UpdateData
): Promise<AdminActionResult<Record<string, unknown>>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "管理者権限が必要です" };

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return { success: false, error: "管理者権限が必要です" };

  const { data: post, error } = await supabase
    .from("ow_company_external_links")
    .update(data)
    .eq("id", id)
    .select("*, ow_companies(id, name)")
    .single();

  if (error) {
    console.error("[updateAdminPost] error:", error);
    return { success: false, error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin/posts");
  return { success: true, data: post as Record<string, unknown> };
}
