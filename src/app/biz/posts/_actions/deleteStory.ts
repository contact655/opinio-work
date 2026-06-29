"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function deleteStory(
  id: string
): Promise<ActionResult> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインしてください" };

  // 所属確認: 削除対象のストーリーが自社のものかをチェック
  const { data: story } = await supabase
    .from("ow_company_posts")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (story) {
    const { data: membership } = await supabase
      .from("ow_company_admins")
      .select("id")
      .eq("company_id", story.company_id)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!membership) return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("ow_company_posts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteStory]", error);
    return { success: false, error: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: null };
}
