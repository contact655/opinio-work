"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

export type CreateStoryData = {
  title: string;
  body: string;
  category: string;
  cover_image_url: string | null;
  is_published: boolean;
};

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createStory(
  data: CreateStoryData
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインしてください" };

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return { success: false, error: "企業権限がありません" };

  if (!data.title || data.title.length > 200)
    return { success: false, error: "タイトルは1〜200字で入力してください" };
  if (!data.body || data.body.length > 100000)
    return { success: false, error: "本文が長すぎます" };
  if (data.category && data.category.length > 50)
    return { success: false, error: "カテゴリは50字以内で入力してください" };
  if (data.cover_image_url) {
    try {
      const parsed = new URL(data.cover_image_url);
      if (parsed.protocol !== "https:") {
        return { success: false, error: "cover_image_urlはhttps://で始まる必要があります" };
      }
      if (data.cover_image_url.length > 2048) {
        return { success: false, error: "cover_image_urlが長すぎます" };
      }
    } catch {
      return { success: false, error: "有効なURLを指定してください" };
    }
  }

  // author_user_id = ow_users.id
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const { data: story, error } = await supabase
    .from("ow_company_posts")
    .insert({
      company_id: ctx.companyId,
      author_user_id: owUser?.id ?? null,
      title: data.title,
      body: data.body,
      category: data.category,
      cover_image_url: data.cover_image_url,
      is_published: data.is_published,
      published_at: data.is_published ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[createStory]", error);
    return { success: false, error: "保存に失敗しました" };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: story as Record<string, unknown> };
}
