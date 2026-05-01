"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CreatePostData, ActionResult } from "./createPost";

type UpdatePostData = Omit<CreatePostData, "company_id">;

export async function updatePost(
  id: string,
  data: UpdatePostData
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "ログインしてください" };
  }

  const { data: post, error } = await supabase
    .from("ow_company_external_links")
    .update({
      url: data.url,
      title: data.title,
      description: data.description,
      thumbnail_url: data.thumbnail_url,
      source_name: data.source_name,
      published_at: data.published_at,
      type: data.type,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updatePost] error:", error);
    return {
      success: false,
      error: `更新に失敗しました: ${error.message}`,
    };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: post as Record<string, unknown> };
}
