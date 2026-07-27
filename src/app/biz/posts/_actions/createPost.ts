"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ALLOWED_POST_TYPES = new Set(["news", "blog", "story", "culture", "product", "event", "other"]);

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

  // 所属確認: auth.users.id → ow_users.id → ow_company_admins の順に解決
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return { success: false, error: "権限がありません" };

  const { data: membership } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", data.company_id)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (!membership) {
    return { success: false, error: "権限がありません" };
  }

  const { data: post, error } = await supabase
    .from("ow_company_external_links")
    .insert({
      company_id: data.company_id,
      url: data.url,
      title: data.title,
      description: data.description,
      thumbnail_url: data.thumbnail_url,
      source_name: data.source_name,
      published_at: data.published_at,
      type: data.type,
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
      error: "投稿の作成に失敗しました",
    };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: post as Record<string, unknown> };
}
