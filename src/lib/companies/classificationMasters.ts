import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClassDomain, ClassIndustry, ClassMasters } from "./classification";

/**
 * ★入力（企業側・運営）の選択肢（2026-10-12）。**公開側には使わない**（公開側は is_active で絞る）。
 *   業種: `retired_at` が空の行（今の有効な行＋まだ出していない新しい行）
 *   事業: `status = 'active'`（運営が認めたもの）＋ この会社が追加して確認待ちのもの
 * ⚠️ admin クライアントで引く（新しい行は is_active=false なので、セッションでは RLS で見えない）。
 *    返すのはマスタの名前と並びだけ（企業の情報は返さない）。
 * ⚠️ 取得に失敗したら null（空の選択肢で保存させない）。
 */
export async function loadClassificationMasters(companyId: string | null): Promise<ClassMasters | null> {
  const db = createAdminClient();
  const [ind, dom, mine] = await Promise.all([
    db.from("ow_industries").select("id, name, slug, parent_id, display_order").is("retired_at", null).order("display_order"),
    db.from("ow_business_domains").select("id, name, slug, industry_id, display_kind, aliases, status, display_order").eq("status", "active"),
    companyId
      ? db.from("ow_business_domain_proposals").select("ow_business_domains!inner(id, name, slug, industry_id, display_kind, aliases, status, display_order)")
          .eq("company_id", companyId).eq("ow_business_domains.status", "pending")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const err = ind.error ?? dom.error ?? mine.error;
  if (err) {
    console.error("[loadClassificationMasters]", err.message);
    return null;
  }
  const industries = (ind.data ?? []) as ClassIndustry[];
  const domains: ClassDomain[] = [];
  const seen = new Set<string>();
  const push = (d: Record<string, unknown>) => {
    if (seen.has(d.id as string)) return;
    seen.add(d.id as string);
    domains.push({
      id: d.id as string, name: d.name as string, slug: d.slug as string,
      industry_id: (d.industry_id as string | null) ?? null,
      display_kind: d.display_kind === "search" ? "search" : "main",
      aliases: Array.isArray(d.aliases) ? (d.aliases as string[]) : [],
      status: d.status === "pending" ? "pending" : "active",
      display_order: (d.display_order as number) ?? 0,
    });
  };
  for (const d of dom.data ?? []) push(d as Record<string, unknown>);
  for (const r of (mine.data ?? []) as unknown as { ow_business_domains: Record<string, unknown> | null }[]) {
    if (r.ow_business_domains) push(r.ow_business_domains);
  }
  return { industries, domains };
}

/** 会社のいまの分類（公開されている値）。⚠️ 取れなければ null */
export async function loadCompanyClassification(companyId: string) {
  const db = createAdminClient();
  const [co, links, cust] = await Promise.all([
    db.from("ow_companies").select("industry_id, capital_type, hq_country, company_stage, serves_consumers, customer_all_industries, employee_count").eq("id", companyId).maybeSingle(),
    db.from("ow_company_business_domains").select("domain_id, is_primary, display_order").eq("company_id", companyId).order("display_order"),
    db.from("ow_company_customer_industries").select("industry_id").eq("company_id", companyId),
  ]);
  const err = co.error ?? links.error ?? cust.error;
  if (err || !co.data) {
    if (err) console.error("[loadCompanyClassification]", err.message);
    return null;
  }
  const c = co.data;
  return {
    value: {
      industryId: (c.industry_id as string | null) ?? "",
      domainIds: (links.data ?? []).map((l) => l.domain_id as string),
      primaryDomainId: ((links.data ?? []).find((l) => l.is_primary)?.domain_id as string | undefined) ?? null,
      capitalType: (c.capital_type as string | null) ?? "",
      hqCountry: (c.hq_country as string | null) ?? "",
      companyStage: (c.company_stage as string | null) ?? "",
      customerIndustryIds: (cust.data ?? []).map((r) => r.industry_id as string),
      servesConsumers: c.serves_consumers === true,
      customerAllIndustries: c.customer_all_industries === true,
    },
    employeeCount: (c.employee_count as string | null) ?? null,
  };
}
