"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeSelfHiring, restoreSelfHiring } from "@/lib/nextManager/server";

/**
 * ★申告の採用中の運営操作（2026-11-19）。外す・外したのを取り消す（本人がもう一度オンにできる状態に戻すだけ）。
 * ⚠️★各操作の先頭で auth_is_admin() を確かめる（Server Action は画面を経由せず直接呼べる）。
 */
export type SelfHiringActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdminOwUserId(): Promise<{ ok: true; owUserId: string | null } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: isAdmin, error } = await supabase.rpc("auth_is_admin");
  if (error) console.error("[admin/self-hiring] auth_is_admin:", error.message);
  if (!isAdmin) return { ok: false, error: "運営権限がありません" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインし直してください" };
  const { data: me, error: meErr } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[admin/self-hiring] me:", meErr.message);
  return { ok: true, owUserId: (me?.id as string | undefined) ?? null };
}

export async function removeSelfHiringByOps(userId: string, companyId: string): Promise<SelfHiringActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(userId) || !UUID_RE.test(companyId)) return { ok: false, error: "見つかりません" };
  const r = await removeSelfHiring({ userId, companyId, byUserId: auth.owUserId, role: "ops" });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/self-hiring");
  return { ok: true };
}

export async function restoreSelfHiringByOps(userId: string, companyId: string): Promise<SelfHiringActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(userId) || !UUID_RE.test(companyId)) return { ok: false, error: "見つかりません" };
  const r = await restoreSelfHiring({ userId, companyId });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/self-hiring");
  return { ok: true };
}
