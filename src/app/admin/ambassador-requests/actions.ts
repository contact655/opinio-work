"use server";

import { createClient } from "@/lib/supabase/server";
import { dismissMember } from "@/lib/companyMembers/decide";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

/* ⚠️ ここにあった `approveRequest`（運営の代理承認）は 2026-08-24 に削除した。
      同日に会社の事前承認を廃止したので、承認する対象が存在しない。
      ⚠️ **戻さないこと。** 戻すなら、事前承認そのものを復活させる判断が先に要る。
      ⚠️ 運営に残っている操作は下の `dismissRequest`（掲載の取り消し）だけ。 */

/**
 * 運営が代理で見送る（行を DELETE）。
 *
 * ⚠️ **却下の記録は残らない**（器を作らないと決めた / 2026-08-23）。行ごと消えるので、
 *    本人の画面は「まだ申請していない」状態に戻る。
 *    本人には見送った旨のメールが届く（理由は書けない）。取り消せないので、
 *    画面側で二段階の確認を挟んでいる。
 */
export async function dismissRequest(memberId: string): Promise<ActionResult> {
  await assertAdmin();

  /* ⚠️ DELETE の戻り行から「本人の申請だったか」を判定して通知するところまで
        decide.ts が持つ。ここで DELETE を書き直さないこと。 */
  const result = await dismissMember(memberId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/ambassador-requests");
  return { ok: true };
}
