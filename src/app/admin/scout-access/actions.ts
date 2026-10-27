"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { grantScoutAccess, declineScoutRequest, revokeScoutAccess } from "@/lib/business/scoutAccess";

export type ActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 運営か確かめ、運営の ow_users.id を返す（許可・取り消しの記録に使う） */
async function assertAdminId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
  const { data: me, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[admin/scout-access] 運営の ow_users:", error.message);
  return (me?.id as string | undefined) ?? null;
}

/* ⚠️ 書き込みと企業へのメールは lib/business/scoutAccess.ts の1か所。ここは運営の確認だけ */

async function wrap(companyId: string, fn: (adminId: string | null) => Promise<{ ok: true } | { ok: false; error: string }>): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "企業IDが不正です" };
  let adminId: string | null = null;
  try { adminId = await assertAdminId(); } catch { return { ok: false, error: "権限がありません" }; }
  const r = await fn(adminId);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/scout-access");
  revalidatePath("/admin/companies");
  revalidatePath("/admin");
  return { ok: true };
}

/** 依頼への許可・依頼が無い企業への直接の付与 */
export async function grantAction(companyId: string): Promise<ActionResult> {
  return wrap(companyId, (a) => grantScoutAccess(companyId, a));
}
/** 依頼を見送る（理由は任意。企業にメールで送る） */
export async function declineAction(companyId: string, reason: string | null): Promise<ActionResult> {
  return wrap(companyId, (a) => declineScoutRequest(companyId, a, reason));
}
/** 取り消す（理由は任意。企業にメールで送る） */
export async function revokeAction(companyId: string, reason: string | null): Promise<ActionResult> {
  return wrap(companyId, (a) => revokeScoutAccess(companyId, a, reason));
}
