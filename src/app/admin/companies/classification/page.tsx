import { createAdminClient } from "@/lib/supabase/admin";
import { loadClassificationMasters } from "@/lib/companies/classificationMasters";
import { companyStageLabel, hqCountryLabel, industryNeedsSub, industryPath, stageCandidateFromEmployees, topOf } from "@/lib/companies/classification";
import { BulkClassificationClient, type BulkRow } from "./BulkClassificationClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "分類の一括設定 | 運営" };

/**
 * ★分類の一括設定（運営。2026-10-12 / 提案A）。
 *   大分類だけの会社・事業ステージが空の会社・外資系で本社の国が空の会社で絞り込み、
 *   チェックを入れてまとめて値を付ける。
 * ⚠️ 初期値（IT → ソフトウェア・SaaS、従業員数からの候補）は表示するだけ。保存は人が押す（判断 #2・#4）。
 * ⚠️ 検証用の会社（is_test）は出さない。
 */
type Filter = "top-only" | "no-stage" | "no-hq" | "all";
const FILTERS: Filter[] = ["top-only", "no-stage", "no-hq", "all"];

export default async function AdminClassificationBulkPage({ searchParams }: { searchParams: { f?: string } }) {
  const filter: Filter = FILTERS.includes(searchParams.f as Filter) ? (searchParams.f as Filter) : "top-only";
  const [masters, { data, error }] = await Promise.all([
    loadClassificationMasters(null),
    createAdminClient().from("ow_companies")
      .select("id, name, listing_status, is_published, industry_id, company_stage, capital_type, hq_country, employee_count")
      .eq("is_test", false).order("name"),
  ]);
  if (!masters || error) {
    if (error) console.error("[admin/classification]", error.message);
    return <p className="p-8 text-sm text-gray-500">取得できませんでした（0件という意味ではありません）。再読み込みしてください。</p>;
  }
  const all = (data ?? []).map((c) => {
    const top = topOf(masters.industries, c.industry_id as string | null);
    const needsSub = industryNeedsSub(masters.industries, c.industry_id as string | null);
    return {
      id: c.id as string,
      name: c.name as string,
      listed: c.listing_status === "listed",
      industry: industryPath(masters.industries, c.industry_id as string | null),
      industryCandidate: needsSub && top?.slug === "it-software" ? "ソフトウェア・SaaS" : null,
      topOnly: needsSub,
      stage: companyStageLabel(c.company_stage as string | null),
      stageCandidate: c.company_stage ? null : companyStageLabel(stageCandidateFromEmployees(c.employee_count as string | null)),
      foreign: c.capital_type === "foreign_subsidiary",
      hq: hqCountryLabel(c.hq_country as string | null),
    } satisfies BulkRow;
  });
  const counts = {
    "top-only": all.filter((r) => r.topOnly).length,
    "no-stage": all.filter((r) => !r.stage).length,
    "no-hq": all.filter((r) => r.foreign && !r.hq).length,
    all: all.length,
  };
  const rows = all.filter((r) =>
    filter === "top-only" ? r.topOnly : filter === "no-stage" ? !r.stage : filter === "no-hq" ? r.foreign && !r.hq : true);
  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-xl font-bold mb-1">分類の一括設定</h1>
      <p className="text-sm text-gray-500 mb-4">チェックを入れた会社に、業種（小分類）・事業ステージ・本社の国をまとめて付けます。候補は表示するだけで、保存は「付ける」を押したときだけです。</p>
      <BulkClassificationClient rows={rows} filter={filter} counts={counts} industries={masters.industries} />
    </div>
  );
}
