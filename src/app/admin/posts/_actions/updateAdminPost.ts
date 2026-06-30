"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AdminActionResult } from "./createAdminPost";

const ALLOWED_POST_TYPES = new Set(["news", "blog", "story", "culture", "product", "event", "other"]);

type UpdateData = {
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
  published_at: string | null;
  type: string;
};

export async function updateAdminPost(
  id: string,
  data: UpdateData
): Promise<AdminActionResult<Record<string, unknown>>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "管理者権限が必要です" };

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return { success: false, error: "管理者権限が必要です" };

  // type allowlist check
  if (!ALLOWED_POST_TYPES.has(data.type)) {
    return { success: false, error: "Invalid type" };
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
    .select("*, ow_companies(id, name)")
    .single();

  if (error) {
    console.error("[updateAdminPost] error:", error);
    return { success: false, error: "更新に失敗しました" };
  }

  revalidatePath("/admin/posts");
  return { success: true, data: post as Record<string, unknown> };
}
