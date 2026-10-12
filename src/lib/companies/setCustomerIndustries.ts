import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone, mutateOne } from "@/lib/supabase/mutate";
import type { DraftCustomers } from "./classification";

/**
 * ★④主なお客さまの業界を入れ替える（2026-10-12）。**入れ替えはここの1か所**（企業の反映と運営の保存が同じ関数を通る）。
 *   明細（ow_company_customer_industries）と、ow_companies の「個人のお客さま」「業界を問わない」を一緒に書く。
 * ⚠️ admin クライアント（明細の書き込みポリシーは運営だけ。呼ぶ前に役割を確かめること）。
 * ⚠️ 大分類だけ・使わなくなった業種は不可（DB のトリガーでも大分類だけを受ける）。
 * ⚠️ 「業界を問わない」を選んだら、ほかは空にする（判断どおり）。
 */
export async function setCompanyCustomerIndustries(
  companyId: string,
  v: DraftCustomers,
  label: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const all = v.all_industries === true;
  const ids = all ? [] : Array.from(new Set(v.industry_ids));
  if (ids.length > 0) {
    const { data, error } = await db.from("ow_industries").select("id").in("id", ids).is("parent_id", null).is("retired_at", null);
    if (error) {
      console.error(`[${label}] お客さまの業界の確認に失敗:`, error.message);
      return { ok: false, status: 500, error: "Internal server error" };
    }
    if ((data ?? []).length !== ids.length) return { ok: false, status: 400, error: "お客さまの業界は大分類から選んでください。" };
  }
  const del = await mutateAllowNone(
    db.from("ow_company_customer_industries").delete().eq("company_id", companyId),
    `${label} お客さま（掃除）`, { returning: "company_id" },
  );
  if (!del.ok) return { ok: false, status: del.status, error: del.error };
  if (ids.length > 0) {
    const { error } = await db.from("ow_company_customer_industries").insert(ids.map((industry_id) => ({ company_id: companyId, industry_id })));
    if (error) {
      console.error(`[${label}] お客さまの業界の保存に失敗:`, error.message);
      return { ok: false, status: 500, error: "お客さまの業界を保存できませんでした。" };
    }
  }
  const up = await mutateOne(
    db.from("ow_companies").update({ serves_consumers: all ? false : v.serves_consumers === true, customer_all_industries: all }).eq("id", companyId),
    `${label} お客さま（列）`,
  );
  if (!up.ok) return { ok: false, status: up.status, error: up.error };
  return { ok: true };
}
