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
    return { success: false, error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: story as Record<string, unknown> };
}
