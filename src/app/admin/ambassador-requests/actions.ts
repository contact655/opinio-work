"use server";

import { createClient } from "@/lib/supabase/server";
import { approveMember, dismissMember } from "@/lib/companyMembers/decide";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

/**
 * 運営が代理で承認する（`is_public` → true）。
 *
 * ── なぜ運営に要るか ────────────────────────────────────────────────────────
 * **掲載中79社のうち77社は通知の宛先が0件**（2026-08-23 実測）で、
 * 企業側に承認できる人がいない。運営が代理承認できないと、
 * 本人の申請は「会社の確認待ち」のまま宙吊りで終わる。
 *
 * ⚠️ 既存の `PATCH /api/biz/ambassador/update` は `getTenantContext()` 必須の
 *    **企業管理者専用**なので流用できない。だから Server Action を別に置く。
 *
 * ⚠️ **`ow_company_admins.is_ambassador` とは無関係。** あちらは別テーブルの別概念で、
 *    公開側からの参照が0件の死にフラグ（`/admin/biz-accounts` の「話せる人」トグル）。
 *    ここに合流させないこと。
 *
 * ⚠️ 承認は**在籍の確認**を意味する。`ow_experiences` の在籍は自己申告なので、
 *    運営が押す前に実態を確かめること（画面にもその旨を出している）。
 */
export async function approveRequest(memberId: string): Promise<ActionResult> {
  await assertAdmin();

  /* ⚠️ 書き込み・通知・キャッシュ破棄は decide.ts の内側。ここで UPDATE しないこと。
        ⚠️ 企業スコープは渡さない。運営は企業をまたいで承認するため。 */
  const result = await approveMember(memberId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/ambassador-requests");
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
