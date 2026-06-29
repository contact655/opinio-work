"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function togglePublish(
  id: string,
  publish: boolean
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインしてください" };

  // 所属確認: ストーリーが自社のものかをチェック
  const { data: existing } = await supabase
    .from("ow_company_posts")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { success: false, error: "権限がありません" };
  const { data: membership } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", existing.company_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!membership) return { success: false, error: "権限がありません" };

  const { data: story, error } = await supabase
    .from("ow_company_posts")
    .update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[togglePublish]", error);
    return { success: false, error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/biz/posts");
  revalidatePath("/companies");
  return { success: true, data: story as Record<string, unknown> };
}
