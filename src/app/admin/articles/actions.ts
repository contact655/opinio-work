"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function toggleArticlePublished(
  articleId: string,
  current: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(articleId)) return { ok: false, error: "Invalid articleId" };
  await assertAdmin();
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("ow_articles").update({
    is_published: !current,
    published_at: !current ? nowIso : null,
    updated_at: nowIso,
  }).eq("id", articleId);
  if (error) return { ok: false, error: "更新に失敗しました" };
  revalidatePath("/admin/articles");
  return { ok: true };
}

export async function linkArticleUser(
  articleId: string,
  userId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(articleId)) return { ok: false, error: "Invalid articleId" };
  if (userId !== null && !UUID_RE.test(userId)) return { ok: false, error: "Invalid userId" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("ow_articles").update({ user_id: userId || null }).eq("id", articleId);
  if (error) return { ok: false, error: "更新に失敗しました" };
  revalidatePath("/admin/articles");
  return { ok: true };
}

export async function linkArticleCompany(
  articleId: string,
  companyId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(articleId)) return { ok: false, error: "Invalid articleId" };
  if (companyId !== null && !UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("ow_articles").update({ company_id: companyId || null }).eq("id", articleId);
  if (error) return { ok: false, error: "更新に失敗しました" };
  revalidatePath("/admin/articles");
  return { ok: true };
}
