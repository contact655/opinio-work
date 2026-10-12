import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★自社の職種に紐づける「標準の職種」（`ow_roles`）を確かめる（2026-10-12）。
 *   有効な行だけを受け付ける。見つからなければ null（呼び出し側が 400 にする）。
 *   ⚠️ 名前は「社内での呼び方が空のとき」の表示名に使う。
 */
export async function lookupStandardRole(id: unknown): Promise<{ id: string; name: string } | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createAdminClient()
    .from("ow_roles").select("id, name").eq("id", id).eq("is_active", true).maybeSingle();
  if (error) { console.error("[lookupStandardRole]", error.message); return null; }
  return data ? { id: data.id as string, name: data.name as string } : null;
}
