"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
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
 * 運営が「確認した」を記録する（2026-08-25）。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * 会社の事前承認を廃止したので、なりすましは**後から見つけて外す**しかない。
 * 「どの行をもう見たか」の記録が無いと、運営は掲載日で判断するしかなく、
 * 見る頻度を決めても取りこぼす。**未確認だけが残る**形にするための印。
 *
 * ⚠️ **元に戻せる**（もう一度押すと未確認に戻る）。押し間違いで情報が消えないため。
 * ⚠️ 掲載状態は**変えない**。ここは運営のメモであって、本人にも企業にも見えない。
 *    ⚠️ 通知も送らない（送ると「運営に見られた」ことが伝わるだけで意味が無い）。
 */
export async function toggleReviewed(memberId: string, reviewed: boolean): Promise<ActionResult> {
  await assertAdmin();

  /* ⚠️ `createClient`（本人セッション）では RLS に阻まれる。運営専用の列なので
        admin クライアントで書く。⚠️ `mutateOne` を通して 0行更新を成功にしない。 */
  const admin = createAdminClient();
  const r = await mutateOne(
    admin
      .from("ow_company_members")
      .update({ ops_reviewed_at: reviewed ? new Date().toISOString() : null })
      .eq("id", memberId),
    "admin toggleReviewed",
    { returning: "id" },
  );
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath("/admin/ambassador-requests");
  /* ⚠️ ダッシュボードの「未確認 N名」も一緒に捨てる。捨てないと数字だけ古く残る。 */
  revalidatePath("/admin");
  return { ok: true };
}

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
