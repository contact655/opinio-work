"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CreatePostData = {
  company_id: string;
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
  published_at: string | null;
  type: string;
};

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createPost(
  data: CreatePostData
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "ログインしてください" };
  }

  const { data: post, error } = await supabase
    .from("ow_company_external_links")
    .insert({
      ...data,
      // published_at: 文字列 "YYYY-MM-DD" → そのまま渡す（null なら null）
      created_by_role: "company",
      created_by_user_id: user.id, // auth.users.id を直接保存
    })
    .select()
    .single();

  if (error) {
    console.error("[createPost] error:", error);
    return {
      success: false,
      error: `保存に失敗しました: ${error.message}`,
    };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: post as Record<string, unknown> };
}
