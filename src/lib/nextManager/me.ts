/* ★サーバー専用 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** ログイン中の ow_users.id（と is_test）。⚠️ ログインしていなければ null */
export async function currentOwUser(): Promise<{ id: string; isTest: boolean } | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await createAdminClient().from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (error) { console.error("[nextManager] me:", error.message); return null; }
  return data ? { id: data.id as string, isTest: data.is_test === true } : null;
}
