import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import LandingPage, {
  type LPCompanyCard,
  type LPJobCard,
  type LPFacet,
  type LPTotals,
} from "./LandingPage";
import { INDUSTRY_GROUPS } from "@/lib/search/industryGroups";

/**
 * 掲載数は実データから出す。ハードコードすると外から見える説明文が古いまま腐るため。
 * サイト共通の layout.tsx 側には数字を置かない（全ページの既定値で気づけないため）。
 */
export async function generateMetadata(): Promise<Metadata> {
  const db = createAdminClient();
  const [{ count: companyCount }, { count: jobCount }] = await Promise.all([
    db.from("ow_companies").select("id", { count: "exact", head: true }).eq("is_published", true),
    db.from("ow_jobs").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);

  const scale =
    companyCount && jobCount
      ? `掲載企業${companyCount.toLocaleString("ja-JP")}社・求人${jobCount.toLocaleString("ja-JP")}件。`
      : "";
  const description = `IT/SaaS業界の企業情報と求人を、ひとつの場所に。${scale}登録なしで全て読めます。スカウトも営業電話もありません。`;

  return {
    title: "OPINIO — IT/SaaS業界の企業と求人を探す",
    description,
    openGraph: {
      title: "OPINIO — IT/SaaS業界の企業と求人を探す",
      description,
      url: "https://opinio.jp",
      siteName: "OPINIO",
      locale: "ja_JP",
      type: "website",
    },
    alternates: { canonical: "https://opinio.jp" },
  };
}

// supabase-js 経由の取得は Next が動的だと判断できず、宣言が無いと静的レンダリング
// 結果が固定される（= コードを変えるまで DB 更新が反映されない）。
// 入口ページなので force-dynamic ではなく ISR で追従させる。
export const revalidate = 300;

/** LP に出すプレビュー件数。実体の絞り込みは一覧ページ側が担う */
const PREVIEW_COMPANIES = 12;
const PREVIEW_JOBS = 12;

export default async function HomePage() {
  const db = createAdminClient();

  // ── ファセット用の軽量取得 ────────────────────────────────────────
  // 集計のために industry / phase の2列だけを引く。行数は企業数に比例するが
  // 列を絞っているので数千社まで許容範囲。これ以上増えたら集計ビューに移す。
  const facetRowsP = db
    .from("ow_companies")
    .select("industry, phase")
    .eq("is_published", true);

  // ── 総件数（count only: 行は取得しない）─────────────────────────
  const companyCountP = db
    .from("ow_companies")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  const jobCountP = db
    .from("ow_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  // ── プレビュー（各12件だけ）──────────────────────────────────────
  const companiesP = db
    .from("ow_companies")
    .select("id, name, brand_name, industry, phase, logo_url, logo_letter, logo_gradient, url")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(PREVIEW_COMPANIES);

  const jobsP = db
    .from("ow_jobs")
    .select(
      "id, title, job_category, salary_min, salary_max, location, employment_type, remote_work_status, company_id, published_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(PREVIEW_JOBS);

  const [facetRes, companyCountRes, jobCountRes, companiesRes, jobsRes] =
    await Promise.all([facetRowsP, companyCountP, jobCountP, companiesP, jobsP]);

  for (const [label, res] of Object.entries({
    facets: facetRes, companies: companiesRes, jobs: jobsRes,
  })) {
    if (res.error) console.error(`[HomePage] ${label} fetch failed:`, res.error.message);
  }

  const totals: LPTotals = {
    companies: companyCountRes.count ?? 0,
    jobs: jobCountRes.count ?? 0,
  };

  // ── ファセット集計 ──────────────────────────────────────────────
  // 0件でもラベルは出す。件数が増えたときに伸びが見えるようにするため、
  // 「0なら隠す」ことはしない。
  const facetRows = (facetRes.data ?? []) as { industry: string | null; phase: string | null }[];

  const industryFacets: LPFacet[] = INDUSTRY_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    count: facetRows.filter((r) => r.industry && (g.values as readonly string[]).includes(r.industry)).length,
    href: `/companies?industry=${g.key}`,
  }));

  // フェーズはDB値が英語・日本語混在。実データは listed / unicorn / non_listed / series_d が確認済み
  // （2026-08-03）。シリーズ表記は今後 A〜E が入りうるので全て「成長ステージ」に寄せる。
  const PHASE_BUCKETS: { label: string; values: string[] }[] = [
    { label: "上場", values: ["listed", "上場"] },
    { label: "ユニコーン", values: ["unicorn", "ユニコーン"] },
    {
      label: "成長ステージ",
      values: [
        "seed", "シード",
        ...["a", "b", "c", "d", "e"].flatMap((s) => [`series_${s}`, `series-${s}`, `シリーズ${s.toUpperCase()}`]),
      ],
    },
    { label: "非上場", values: ["non_listed", "非上場"] },
  ];
  const phaseFacets: LPFacet[] = PHASE_BUCKETS.map((b) => ({
    key: b.label,
    label: b.label,
    count: facetRows.filter((r) => r.phase && b.values.includes(r.phase)).length,
    href: `/companies?phase=${encodeURIComponent(b.label)}`,
  }));

  // ── 企業カードの付帯件数 ────────────────────────────────────────
  // プレビュー12社ぶんだけを対象にするので、件数が増えても負荷は一定。
  const companyRows = (companiesRes.data ?? []) as {
    id: string; name: string; brand_name: string | null; industry: string | null;
    phase: string | null; logo_url: string | null; logo_letter: string | null;
    logo_gradient: string | null; url: string | null;
  }[];
  const previewIds = companyRows.map((c) => c.id);

  const tally = async (table: string, col: string, filter?: [string, string]) => {
    const map = new Map<string, number>();
    if (previewIds.length === 0) return map;
    let q = db.from(table).select(col).in(col, previewIds);
    if (filter) q = q.eq(filter[0], filter[1]);
    const { data, error } = await q;
    if (error) { console.error(`[HomePage] ${table} tally failed:`, error.message); return map; }
    for (const row of (data ?? []) as unknown as Record<string, string>[]) {
      const id = row[col];
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };

  const [articleByCompany, jobByCompany, memberByCompany] = await Promise.all([
    tally("ow_articles", "company_id", ["is_published", "true"]),
    tally("ow_jobs", "company_id", ["status", "published"]),
    tally("ow_company_members", "company_id", ["is_public", "true"]),
  ]);

  const companies: LPCompanyCard[] = companyRows.map((c) => ({
    id: c.id,
    name: c.brand_name ?? c.name,
    industry: c.industry,
    phase: c.phase,
    logoUrl: c.logo_url,
    logoLetter: c.logo_letter,
    logoGradient: c.logo_gradient,
    companyUrl: c.url,
    // 0 でもそのまま出す
    articleCount: articleByCompany.get(c.id) ?? 0,
    jobCount: jobByCompany.get(c.id) ?? 0,
    memberCount: memberByCompany.get(c.id) ?? 0,
  }));

  // ── 求人カード ──────────────────────────────────────────────────
  const jobRows = (jobsRes.data ?? []) as {
    id: string; title: string; job_category: string | null;
    salary_min: number | null; salary_max: number | null;
    location: string | null; employment_type: string | null;
    remote_work_status: string | null; company_id: string;
  }[];

  const jobCompanyIds = Array.from(new Set(jobRows.map((j) => j.company_id).filter(Boolean)));
  const companyNameById = new Map<string, string>();
  if (jobCompanyIds.length > 0) {
    const { data, error } = await db
      .from("ow_companies")
      .select("id, name, brand_name")
      .in("id", jobCompanyIds);
    if (error) console.error("[HomePage] job companies fetch failed:", error.message);
    for (const c of (data ?? []) as { id: string; name: string; brand_name: string | null }[]) {
      companyNameById.set(c.id, c.brand_name ?? c.name);
    }
  }

  const jobs: LPJobCard[] = jobRows.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: companyNameById.get(j.company_id) ?? "",
    jobCategory: j.job_category,
    // salary_min/max の単位は円ではなく万円
    salaryMin: j.salary_min,
    salaryMax: j.salary_max,
    location: j.location,
    employmentType: j.employment_type,
    remoteStatus: j.remote_work_status,
  }));

  return (
    <LandingPage
      totals={totals}
      industryFacets={industryFacets}
      phaseFacets={phaseFacets}
      companies={companies}
      jobs={jobs}
    />
  );
}
