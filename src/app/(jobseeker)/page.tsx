import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import LandingPage, {
  type LPCompanyCard,
  type LPJobCard,
  type LPFacet,
  type LPTotals,
} from "./LandingPage";
import { INDUSTRY_GROUPS } from "@/lib/search/industryGroups";
import { pickLpCompanies } from "@/lib/lp/pickCompanies";

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
  // ⚠️ 2026-08-03: 「スカウトも営業電話もありません」を削除した。事実と異なっていたため。
  //    スカウト機能は実装済みで（ow_scouts / can_send_scout）、受け取る設定にした場合に
  //    だけ届く（初期設定はオフ）。この但し書きは description に収まらないので触れず、
  //    正確な説明は LP の FAQ に置いている。営業電話が無いのは事実なので残す。
  //    ここは LP の generateMetadata で、layout の既定値を上書きする。
  //    検索結果と SNS シェアに最も出るのはこの文言なので、方針変更時は真っ先に直すこと。
  const description = `IT/SaaS業界の企業情報と求人を、ひとつの場所に。${scale}登録なしで全て読めます。完全無料・営業電話なし。`;

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

  // ── 出身校ファセット ────────────────────────────────────────────
  // 公開ユーザーの学歴のみ。行数はユーザー数に比例するが、学歴レコードは
  // ユーザーあたり数件なので集計コストは低い。
  const schoolRowsP = db
    .from("ow_user_educations")
    .select("user_id, school_id, ow_schools!school_id(id, name), ow_users!user_id(is_test, is_system, visibility)")
    .not("school_id", "is", null);

  // ── プレビュー（各12件だけ）──────────────────────────────────────
  const jobsP = db
    .from("ow_jobs")
    .select(
      "id, title, job_category, salary_min, salary_max, location, employment_type, remote_work_status, company_id, published_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(PREVIEW_JOBS);

  const [facetRes, companyCountRes, jobCountRes, jobsRes, schoolRes] =
    await Promise.all([facetRowsP, companyCountP, jobCountP, jobsP, schoolRowsP]);

  // ── ピックアップ企業の選定 ──────────────────────────────────────
  // ⚠️ 基準は src/lib/lp/pickCompanies.ts に切り出してある。
  //    在庫が増えたら「注目順／新着順」に差し替えるのはあちらだけで済む。
  const companyRowsRaw = await pickLpCompanies(db, PREVIEW_COMPANIES);

  for (const [label, res] of Object.entries({
    facets: facetRes, jobs: jobsRes, schools: schoolRes,
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

  // ── 企業カードの付帯件数 ────────────────────────────────────────
  // プレビュー12社ぶんだけを対象にするので、件数が増えても負荷は一定。
  const companyRows = companyRowsRaw as unknown as {
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

  // ⚠️ ow_company_members は数えていない。2026-08-05 にカードから「社員」を外したため。
  //    理由は src/lib/lp/pickCompanies.ts のコメントを参照。
  const [articleByCompany, jobByCompany] = await Promise.all([
    tally("ow_articles", "company_id", ["is_published", "true"]),
    tally("ow_jobs", "company_id", ["status", "published"]),
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

  // ── 出身校ファセット ────────────────────────────────────────────
  // 本人の非公開希望を優先する（private は除外）。テスト・システムユーザーも外す。
  type EduRow = {
    user_id: string;
    ow_schools: { id: string; name: string } | null;
    ow_users: { is_test: boolean | null; is_system: boolean | null; visibility: string | null } | null;
  };
  const bySchool = new Map<string, { name: string; users: Set<string> }>();
  for (const r of (schoolRes.data ?? []) as unknown as EduRow[]) {
    const s = r.ow_schools;
    const u = r.ow_users;
    if (!s || !u) continue;
    if (u.is_test === true || u.is_system === true || u.visibility === "private") continue;
    const entry = bySchool.get(s.id) ?? { name: s.name, users: new Set<string>() };
    entry.users.add(r.user_id);
    bySchool.set(s.id, entry);
  }
  const allSchoolFacets: LPFacet[] = Array.from(bySchool.entries())
    .map(([id, v]) => ({ key: id, label: v.name, count: v.users.size, href: `/schools/${id}` }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"))
    .slice(0, 12);

  /**
   * 「人から探す」を出すかどうかの閾値。5校以上かつ実人数10名以上。
   *
   * なぜ隠すか: 1名の学校がいくつも並ぶ状態は、探す手がかりとして機能しない。
   * 「数を隠さない」方針とは矛盾しない ——「表示する値を偽らない」ことと
   * 「セクションを出すかどうか」は別の判断で、ここは後者。出す値は常に実数。
   *
   * なぜ2条件か: 学校数だけでは足りず、1校あたりの密度が要る。チップをクリックした
   * 先が1名では回遊にならないため、平均2名程度（= 5校に対して10名）になるまで待つ。
   *
   * 人数は distinct なユーザー数で数える。1人が高校と大学の2件を登録するため、
   * 学校ごとの件数を単純合計すると同じ人を重複して数えてしまう
   * （2026-08-03 時点: 8校 / 学歴9件 / 実人数5名 → 人数が足りず非表示）。
   *
   * データが増えて閾値を超えれば自動的に表示される。将来ここが表示されていない
   * 場合は、バグではなくこの閾値に達していないだけ。
   */
  const SCHOOL_MIN_SCHOOLS = 5;
  const SCHOOL_MIN_USERS = 10;
  const distinctSchoolUsers = new Set(
    Array.from(bySchool.values()).flatMap((v) => Array.from(v.users))
  ).size;
  const schoolFacets: LPFacet[] =
    allSchoolFacets.length >= SCHOOL_MIN_SCHOOLS && distinctSchoolUsers >= SCHOOL_MIN_USERS
      ? allSchoolFacets
      : [];

  return (
    <LandingPage
      totals={totals}
      industryFacets={industryFacets}
      schoolFacets={schoolFacets}
      companies={companies}
      jobs={jobs}
    />
  );
}
