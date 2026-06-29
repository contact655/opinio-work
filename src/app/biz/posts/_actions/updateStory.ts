"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type UpdateStoryData = {
  title: string;
  body: string;
  category: string;
  cover_image_url: string | null;
};

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function updateStory(
  id: string,
  data: UpdateStoryData
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

  if (!data.title || data.title.length > 200)
    return { success: false, error: "タイトルは1〜200字で入力してください" };
  if (!data.body || data.body.length > 100000)
    return { success: false, error: "本文が長すぎます" };
  if (data.category && data.category.length > 50)
    return { success: false, error: "カテゴリは50字以内で入力してください" };

  const { data: story, error } = await supabase
    .from("ow_company_posts")
    .update({
      title: data.title,
      body: data.body,
      category: data.category,
      cover_image_url: data.cover_image_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateStory]", error);
    return { success: false, error: "更新に失敗しました" };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: story as Record<string, unknown> };
}
