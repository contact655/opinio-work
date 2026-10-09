"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { mutateOne } from "@/lib/supabase/mutate";
import { APPROACH_RANGE_FIELDS } from "@/lib/approaches/range";

export type ActionResult = { ok: boolean; error?: string };

/**
 * ★声かけを受け取る範囲の項目を有効／無効にする（運営だけ）。
 * ⚠️ 割合で自動に切り替えない（企業1社の登録で求職者の受け取り範囲が急に変わるため）。押すのは運営。
 * ⚠️ 有効にした瞬間、その項目に値を入れている人の判定に使われ始める（無効のあいだに入れた値も含む）。
 */
export async function setApproachRangeField(field: string, enabled: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return { ok: false, error: "権限がありません" };
  if (!(APPROACH_RANGE_FIELDS as readonly string[]).includes(field)) return { ok: false, error: `不正な項目です: ${field}` };

  const r = await mutateOne(
    createAdminClient().from("ow_approach_range_fields").update({ enabled, updated_at: new Date().toISOString() }).eq("field", field),
    "approach range field", { returning: "field" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/approach-range");
  return { ok: true };
}
