import { createAdminClient } from "@/lib/supabase/admin";
import ScoutQuotasClient from "./ScoutQuotasClient";
import { SCOUT_MONTHLY_LIMIT_DEFAULT, usedThisMonth } from "@/lib/constants/scoutQuota";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "スカウト枠管理 | OPINIO Admin" } };

export default async function ScoutQuotasPage() {
  const admin = createAdminClient();

  // ow_scout_quotas + 企業名
  const { data: quotaRows } = await admin
    .from("ow_scout_quotas")
    .select("company_id, monthly_limit, bonus_credits, used_this_month, period_start, ow_companies(id, name)")
    .order("company_id");

  // ow_companies で枠未設定の企業も含める
  const { data: allCompanies } = await admin
    .from("ow_companies")
    .select("id, name")
    .eq("is_published", true)
    .order("name");

  const quotaMap = new Map((quotaRows ?? []).map((q: any) => [q.company_id as string, q]));

  const quotas = (allCompanies ?? []).map((c: any) => {
    const q = quotaMap.get(c.id as string);
    return {
      companyId: c.id as string,
      companyName: c.name as string,
      quotaId: null,
      /* ⚠️ 行が無い企業には DB の DEFAULT が適用されるので、この 30 は**実際に効く値**。
            ただし「運営が決めた」のか「まだ決めていない」のかは別に示す（`configured`）。 */
      monthlyLimit: (q?.monthly_limit as number) ?? SCOUT_MONTHLY_LIMIT_DEFAULT,
      bonusCredits: (q?.bonus_credits as number) ?? 0,
      /* ⚠️★`used_this_month` を素で出さない。月次リセットはトリガーではなく
            `can_send_scout()` の中でしか起きないので、**次の送信まで先月の数字が残る。** */
      usedThisMonth: usedThisMonth(q?.used_this_month as number | undefined,
                                   q?.period_start as string | undefined),
      periodStart: (q?.period_start as string) ?? null,
      /** 枠の行が実在するか。false なら DB の既定値が効いているだけ */
      configured: !!q,
    };
  });

  return <ScoutQuotasClient quotas={quotas} />;
}
