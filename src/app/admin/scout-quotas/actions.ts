"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ow_scout_quotas は company_id を PK とする 1社1行設計。
// ⚠️★**企業を作った時点では行を作らない。** 最初の送信時に `can_send_scout()` が作る。
//    実測（2026-08-29 / 本番）: 0行。行が無い企業には DB の `DEFAULT 30` が効く。
//
// ⚠️★訂正（2026-08-29）: 以前ここに「period_start は月次リセット時に DB トリガーが
//    更新する」と書いてあったが**事実と違う**。**トリガーも cron も存在しない**
//    （migration と本番の両方で確認）。`used_this_month` を 0 に戻すのは
//    `can_send_scout()` の中だけで、**次に誰かが送信するまで先月の数字が残る。**
//    表示側は `lib/constants/scoutQuota.ts` の `usedThisMonth()` を通すこと。

export async function grantBonusCredits(companyId: string, amount: number): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("ow_scout_quotas")
    .select("company_id, bonus_credits")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("ow_scout_quotas")
      .update({ bonus_credits: (existing.bonus_credits as number) + amount })
      .eq("company_id", companyId);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("ow_scout_quotas")
      /* ⚠️★`monthly_limit` を書かない（2026-08-29）。書くと DB の `DEFAULT` を通らず、
            既定値を変えてもこの経路だけ古い値を入れ続ける。
            ここは**追加枠を付けるだけ**で、月次上限には触らないのが正しい。 */
      .insert({ company_id: companyId, bonus_credits: amount, used_this_month: 0 });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/scout-quotas");
  return {};
}

export async function updateMonthlyLimit(companyId: string, limit: number): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("ow_scout_quotas")
    .select("company_id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("ow_scout_quotas")
      .update({ monthly_limit: limit })
      .eq("company_id", companyId);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("ow_scout_quotas")
      /* ⚠️ こちらは `monthly_limit` を**明示するのが正しい**。運営が値を決めて
            行を作る操作だから。上の `grantBonusCredits` とは意図が違う。 */
      .insert({ company_id: companyId, monthly_limit: limit, bonus_credits: 0, used_this_month: 0 });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/scout-quotas");
  return {};
}
