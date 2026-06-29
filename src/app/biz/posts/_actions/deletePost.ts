"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./createPost";

export async function deletePost(id: string): Promise<ActionResult<null>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "ログインしてください" };
  }

  // 所属確認: 削除対象の投稿が自社のものかをチェック
  const { data: post } = await supabase
    .from("ow_company_external_links")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (post) {
    const { data: membership } = await supabase
      .from("ow_company_admins")
      .select("id")
      .eq("company_id", post.company_id)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!membership) return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("ow_company_external_links")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deletePost] error:", error);
    return {
      success: false,
      error: `削除に失敗しました: ${error.message}`,
    };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: null };
}
