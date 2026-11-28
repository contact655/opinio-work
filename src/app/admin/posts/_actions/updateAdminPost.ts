"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AdminActionResult } from "./createAdminPost";
import { isAdminPostType } from "@/lib/constants/externalLinkTypes";

/* ★種類は lib/constants/externalLinkTypes.ts の1か所（2026-11-28）。ここに書き写さない。
   ⚠️ それまでここだけ別の語彙（news / blog …）で、記事・動画・音声・SNS が「Invalid type」で保存できなかった */

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
  if (!isAdminPostType(data.type)) {
    return { success: false, error: "種類が正しくありません" };
  }

  function validateHttpsUrl(val: string | null | undefined): string | null {
    if (!val) return null;
    try {
      const p = new URL(val);
      if (p.protocol !== "https:") return null;
      return val.length <= 2048 ? val : null;
    } catch { return null; }
  }

  const safeUrl = validateHttpsUrl(data.url);
  if (data.url && !safeUrl) {
    return { success: false, error: "urlはhttps://で始まる有効なURLを指定してください" };
  }
  const safeThumbnailUrl = validateHttpsUrl(data.thumbnail_url);

  const { data: post, error } = await supabase
    .from("ow_company_external_links")
    .update({
      url: safeUrl ?? data.url,
      title: data.title,
      description: data.description,
      thumbnail_url: safeThumbnailUrl,
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
