"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CreatePostData, ActionResult } from "./createPost";

const ALLOWED_POST_TYPES = new Set(["news", "blog", "story", "culture", "product", "event", "other"]);

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

  // type allowlist check
  if (!ALLOWED_POST_TYPES.has(data.type)) {
    return { success: false, error: "Invalid type" };
  }

  // length limits
  if (data.url.length > 2048) return { success: false, error: "URL が長すぎます" };
  if (data.title.length > 200) return { success: false, error: "タイトルが長すぎます" };
  if (data.description && data.description.length > 2000) return { success: false, error: "説明が長すぎます" };
  if (data.source_name && data.source_name.length > 200) return { success: false, error: "ソース名が長すぎます" };

  // URL protocol validation
  if (!data.url.startsWith("https://")) return { success: false, error: "URL は https:// で始めてください" };
  if (data.thumbnail_url && !data.thumbnail_url.startsWith("https://")) return { success: false, error: "サムネ URL は https:// で始めてください" };

  // 所属確認: 更新対象の投稿が自社のものかをチェック
  const { data: existing } = await supabase
    .from("ow_company_external_links")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { success: false, error: "権限がありません" };
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return { success: false, error: "権限がありません" };

  const { data: membership } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", existing.company_id)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (!membership) return { success: false, error: "権限がありません" };

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
      error: "更新に失敗しました",
    };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: post as Record<string, unknown> };
}
