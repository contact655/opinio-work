import { createAdminClient } from "@/lib/supabase/admin";
import { loadClassificationMasters } from "@/lib/companies/classificationMasters";
import { topIndustries } from "@/lib/companies/classification";
import { PendingDomainsClient, type PendingDomainRow } from "./PendingDomainsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "追加された事業 | 運営" };

/** ★企業が追加した事業（確認待ち）の一覧（運営。2026-10-12）。⚠️ 取得に失敗したら0件と書かない */
export default async function AdminPendingDomainsPage() {
  const db = createAdminClient();
  const [masters, { data, error }] = await Promise.all([
    loadClassificationMasters(null),
    db.from("ow_business_domains")
      .select("id, name, industry_id, created_at, ow_business_domain_proposals(company_id, created_at, ow_companies(name, is_test))")
      .eq("status", "pending").order("created_at"),
  ]);
  if (!masters || error) {
    if (error) console.error("[admin/business-domains]", error.message);
    return <p className="p-8 text-sm text-gray-500">取得できませんでした（0件という意味ではありません）。再読み込みしてください。</p>;
  }
  const rows: PendingDomainRow[] = (data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    industryId: (d.industry_id as string | null) ?? null,
    companies: ((d.ow_business_domain_proposals as unknown as { ow_companies: { name: string; is_test: boolean } | null }[]) ?? [])
      .map((p) => (p.ow_companies ? `${p.ow_companies.name}${p.ow_companies.is_test ? "（検証用）" : ""}` : "（不明）")),
  }));
  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-bold mb-1">追加された事業</h1>
      <p className="text-sm text-gray-500 mb-4">企業が「見つからない」ときに追加した事業です。確認待ちのあいだは、追加した会社にだけ表示され、求職者には出ません。</p>
      <PendingDomainsClient rows={rows} tops={topIndustries(masters.industries)}
        targets={masters.domains.filter((d) => d.status === "active").map((d) => ({ id: d.id, name: d.name }))} />
    </div>
  );
}
