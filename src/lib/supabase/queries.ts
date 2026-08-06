/**
 * queries.ts — Supabase data access layer for Stage 1 (read-only public pages)
 *
 * Scope: ow_companies + ow_jobs only (ow_ prefix tables only)
 * Mentors: ow_mentors テーブルは migration 140 で削除済み。ambassador 機能に移行。
 * Articles: mock継続 (ow_articles テーブルなし)
 */

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createClient } from "./server";
import { createAdminClient } from "./admin";
import { createPublicClient } from "./public";
import { buildRoleTree, type RoleTree, type RoleNode } from "@/lib/roles/jobRoles";
import { pickRoleLabel, fetchCompanyRoleMap } from "@/lib/jobs/roleLabel";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import type { Company, CompanyGenre } from "@/app/companies/mockCompanies";
import type { Job } from "@/app/jobs/mockJobData";
import type {
  CompanyDetail,
  CompanyNumbers,
  JobCat,
  JobItem,
} from "@/app/companies/[id]/mockDetailData";
import type {
  Article,
  ArticleSubject,
  QA,
  ThemeItem,
  Chapter,
} from "@/app/articles/mockArticleData";
import { MOCK_ARTICLES } from "@/app/articles/mockArticleData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_GRADIENT = "linear-gradient(135deg, var(--royal), #3B5FD9)";

const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート可",
  hybrid: "ハイブリッド",
  on_site: "原則出社",
};

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCompany(row: Record<string, any>, jobCount = 0, genres: CompanyGenre[] = []): Company {
  return {
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    name: (row.name as string) ?? "",
    name_en: (row.name_en as string | null) ?? null,
    tagline: (row.tagline as string) ?? "",
    industry: (row.industry as string) ?? "",
    phase: (row.phase as string) ?? "",
    employee_count: (row.employee_count as number) ?? 0,
    job_count: jobCount,
    current_mentors: 0,
    alumni_mentors: 0,
    accepting_casual_meetings: (row.accepting_casual_meetings as boolean) ?? false,
    /* ⚠️ 2026-08-06: null フォールバックを削除した。jobs_public は NOT NULL DEFAULT false
          なので null になりえず、分岐は発火しなかった。
       ⚠️ jobs_public 自体の参照は同日にゼロになっている（面談CTAは
          accepting_casual_meetings に統一）。この値を新しい判定に使わないこと。 */
    jobs_public: (row.jobs_public as boolean) ?? false,
    updated_days_ago: daysSince(row.updated_at as string),
    gradient: (row.logo_gradient as string) ?? FALLBACK_GRADIENT,
    logo_url: (row.logo_url as string | null) ?? null,
    logo_letter: (row.logo_letter as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    x_url: (row.x_url as string | null) ?? null,
    linkedin_url: (row.linkedin_url as string | null) ?? null,
    careers_url: (row.careers_url as string | null) ?? null,
    genres,
    is_editors_pick: false,
    is_dimmed: false,
    // ⚠️ リンク生成の判定用。dev では getCompanies が is_published で絞らないので、
    //    出す側がこの値を見ること（CLAUDE.md「企業ページへのリンクは env に関係なく…」）
    is_published: (row.is_published as boolean) ?? false,
    brand_name: (row.brand_name as string | null) ?? null,
    industry_id: (row.industry_id as string | null) ?? null,
    saas_category_id: (row.saas_category_id as string | null) ?? null,
    mission: (row.mission as string | null) ?? null,
    fit_positives: Array.isArray(row.fit_positives) ? (row.fit_positives as string[]) : null,
    about: (row.description as string | null) ?? null,
    why_join: (() => {
      const wj = row.why_join as string | null | undefined;
      const desc = row.description as string | null | undefined;
      if (typeof wj === "string" && wj.trim() && wj.trim() !== (desc ?? "").trim()) return wj.trim();
      return null;
    })(),
    benefits: Array.isArray(row.benefits) && (row.benefits as string[]).length > 0 ? (row.benefits as string[]) : null,
    evaluationSystem: (row.evaluation_system as string | null) ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapJob(row: Record<string, any>): Job {
  const publishedAt = row.published_at as string | null;
  const isNew = publishedAt ? daysSince(publishedAt) <= 7 : false;

  // salary は万円単位で格納されている想定
  const salaryMin = (row.salary_min as number) ?? 0;
  const salaryMax = (row.salary_max as number) ?? 0;

  // tags: work_style + employment_type + location から生成
  const tags: string[] = [];
  const rawWs = (row.work_style ?? row.remote_work_status) as string | null;
  if (rawWs) tags.push(WORK_STYLE_LABELS[rawWs] ?? rawWs);
  if (row.location) tags.push((row.location as string).split("・")[0]);

  // required_skills: string or string[]
  const reqRaw = row.requirements ?? row.required_skills;
  const requiredSkills: string[] = Array.isArray(reqRaw)
    ? reqRaw
    : typeof reqRaw === "string" && reqRaw.trim()
    ? reqRaw.split(/\n|\\n|・|、/).map((s: string) => s.replace(/\\n/g, "").trim()).filter(Boolean)
    : [];

  const prefRaw = row.preferred_skills ?? row.preferred;
  const preferredSkills: string[] = Array.isArray(prefRaw)
    ? prefRaw
    : typeof prefRaw === "string" && prefRaw.trim()
    ? prefRaw.split(/\n|\\n|・|、/).map((s: string) => s.replace(/\\n/g, "").trim()).filter(Boolean)
    : [];

  // selection_flow: from selection_process (might be string[] or null)
  const selectionRaw = row.selection_process;
  const selectionFlow = Array.isArray(selectionRaw)
    ? selectionRaw.map((step: string, i: number) => ({
        step: String(i + 1),
        name: step,
        meta: "",
      }))
    : [];

  return {
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    company_id: row.company_id as string,
    role: (row.title as string) ?? "",
    // ⚠️ dept は ow_jobs.job_category（廃止予定のフリーテキスト）。
    //    職種の判定・フィルタには使わないこと。roleIds / roleName を使う。
    //    2026-08-03 時点で残しているのは /salary が job_category の粒度に
    //    合わせて作られているため（別タスクで整理する）。
    dept: (row.job_category as string) ?? "",
    // ⚠️ role_category_id は migration の一括投入のまま。biz UI が更新しないため廃止予定。
    role_category_id: (row.role_category_id as string) ?? undefined,
    employment_type: (row.employment_type as string) ?? "正社員",
    location: (row.location as string) ?? "",
    work_style: (() => { const raw = (row.work_style ?? row.remote_work_status) as string | null; return raw ? (WORK_STYLE_LABELS[raw] ?? raw) : ""; })(),
    salary_min: salaryMin,
    salary_max: salaryMax,
    experience: "",
    tags,
    highlight: (row.catch_copy as string) ?? (row.one_liner as string) ?? "",
    updated_days_ago: daysSince(row.updated_at as string),
    is_new: isNew,
    urgency: (row.urgency as "open" | "hot") ?? "open",
    dept_members: 0,
    member_avatars: [],
    // detail fields
    overview: (row.description as string) ?? (row.what_youll_do_intro as string) ?? "",
    main_tasks: [],
    required_skills: requiredSkills,
    preferred_skills: preferredSkills,
    benefits: [],
    selection_flow: selectionFlow,
    selection_note: (row.message_to_candidates as string) ?? "",
    position_members: [],
    related_article_title: "",
    related_article_excerpt: "",
    // enrichment fields (Migration 147)
    why_hire: (row.why_hire as string) ?? null,
    team_composition: (row.team_composition as string) ?? null,
    first_90_days: (row.first_90_days as string) ?? null,
    // 業態タグ (Migration 210)
    business_model: (row.business_model as string) ?? null,
    // セールス職専用項目 (Migration 212)
    ote_min: (row.ote_min as number) ?? null,
    ote_max: (row.ote_max as number) ?? null,
    sales_segment: Array.isArray(row.sales_segment) ? (row.sales_segment as string[]) : null,
    sales_hunter_farmer: (row.sales_hunter_farmer as string) ?? null,
    incentive_note: (row.incentive_note as string) ?? null,
    // 技術スタック (Migration 245)
    tech_stack: Array.isArray(row.tech_stack) ? (row.tech_stack as string[]) : [],
    published_at: (row.published_at as string) ?? null,
    expires_at: (row.expires_at as string) ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCompanyDetail(row: Record<string, any>, jobs: Record<string, any>[], roles: Record<string, any>[] = []): CompanyDetail {
  // jobs → JobCat[] (ow_roles 親カテゴリでグループ化)
  const jobCats: JobCat[] = jobs.length > 0
    ? (() => {
        // ow_roles を id でマップ化
        const rolesMap = new Map(roles.map((r) => [r.id as string, r]));

        // role_category_id → 親カテゴリ {name, id} を解決
        function getParentCatInfo(roleId: string | null | undefined, jobCategory?: string | null): { name: string; id?: string } {
          if (!roleId) return { name: jobCategory?.trim() || "その他" };
          const role = rolesMap.get(roleId);
          if (!role) return { name: jobCategory?.trim() || "その他" };
          if (!role.parent_id) return { name: role.name as string, id: role.id as string };  // 自身が親
          const parent = rolesMap.get(role.parent_id as string);
          return parent
            ? { name: parent.name as string, id: parent.id as string }
            : { name: role.name as string, id: role.id as string };
        }

        // 親カテゴリごとにグループ化 (catId も記録)
        const grouped = new Map<string, { items: typeof jobs; catId: string | undefined }>();
        for (const j of jobs) {
          const { name: cat, id: catId } = getParentCatInfo(j.role_category_id as string | null, j.job_category as string | null);
          if (!grouped.has(cat)) grouped.set(cat, { items: [], catId });
          grouped.get(cat)!.items.push(j);
        }

        return Array.from(grouped.entries()).map(([cat, { items, catId }]) => ({
          cat,
          catId,
          total: items.length,
          items: items.map((j) => {
            const sMin = j.salary_min as number;
            const sMax = j.salary_max as number;
            const salary = sMin && sMax ? `¥${sMin}–${sMax}万` : "応相談";
            const item: JobItem = {
              id: j.id as string,
              slug: (j.slug as string | null) ?? null,
              title: (j.title as string) ?? "",
              tags: [],
              salary,
              salaryMin: (j.salary_min as number) || null,
              salaryMax: (j.salary_max as number) || null,
              description: (j.description as string) || null,
              requirements: (j.requirements as string) || null,
              selectionProcess: (j.selection_process as string) || null,
              whyHire: (j.why_hire as string) || null,
              catchCopy: (j.catch_copy as string) || null,
              workStyle: (j.work_style as string) || null,
              location: (j.location as string) || null,
              employmentType: (j.employment_type as string) || null,
            };
            const pub = j.published_at as string | null;
            if (pub) item.publishedAt = pub;
            if (pub && daysSince(pub) <= 7) item.is_new = true;
            if (j.urgency === "hot") item.urgency = "hot";
            return item;
          }),
        }));
      })()
    : [];

  return {
    id: row.id as string,
    mission: (row.mission as string) ?? (row.tagline as string) ?? "",
    about: (row.description as string) ?? (row.why_join as string)
      ?? `${row.name ?? ""}は、${row.tagline ?? ""}`,
    established: row.founded_year ? `${row.founded_year}年` : null,
    ceo: (row.ceo_name as string) ?? null,
    capital: "非公開",
    hq: (row.location as string) ?? null,
    url: (row.url as string) ?? "",
    company_features: Array.isArray(row.company_features) ? row.company_features as string[] : [],
    freshness: [],
    jobs: jobCats,
    current: [],
    alumni: [],
    interviews: [],
    articles: [],
    related: [],
    mentor_avatars: [],
    mentor_current: 0,
    mentor_alumni: 0,
    // Numbers section (Commit AA)
    numbers: buildCompanyNumbers(row),
    // Benefits section (Commit BB)
    nearestStation: (row.nearest_station as string | null) ?? null,
    workTimeSystem: (row.work_time_system as string | null) ?? null,
    workstyleDescription: (row.workstyle_description as string | null) ?? null,
    benefits: Array.isArray(row.benefits) && (row.benefits as string[]).length > 0
      ? (row.benefits as string[])
      : null,
    evaluationSystem: (row.evaluation_system as string | null) ?? null,
    // Fit section
    fit_positives: Array.isArray(row.fit_positives) && (row.fit_positives as string[]).length > 0
      ? (row.fit_positives as string[])
      : null,
    fit_negatives: Array.isArray(row.fit_negatives) && (row.fit_negatives as string[]).length > 0
      ? (row.fit_negatives as string[])
      : null,
    show_fit_negatives: (row.show_fit_negatives as boolean | null) ?? false,
    // Why join — separate from description/about
    why_join: (() => {
      const wj = row.why_join as string | null | undefined;
      const desc = row.description as string | null | undefined;
      // Only show why_join if it exists AND is different from description
      if (typeof wj === "string" && wj.trim() && wj.trim() !== (desc ?? "").trim()) {
        return wj.trim();
      }
      return null;
    })(),
    // Culture description
    culture_description: (row.culture_description as string | null) ?? null,
    culture_keywords: (row.culture_keywords as string[] | null) ?? null,
    // Products & Customers
    main_products: Array.isArray(row.main_products) && (row.main_products as string[]).length > 0
      ? (row.main_products as string[])
      : null,
    main_customers: Array.isArray(row.main_customers) && (row.main_customers as string[]).length > 0
      ? (row.main_customers as string[])
      : null,
    // Numbers survey timestamp
    numbersUpdatedAt: (row.numbers_updated_at as string | null) ?? null,
    // Org teams
    orgTeams: Array.isArray(row.org_teams) ? row.org_teams as CompanyDetail["orgTeams"] : null,
    // Customer cases
    customer_cases: Array.isArray(row.customer_cases) ? row.customer_cases as CompanyDetail["customer_cases"] : null,
    // Reality disclosure
    reality_disclosure: row.reality_disclosure
      ? (row.reality_disclosure as CompanyDetail["reality_disclosure"])
      : null,
    // ② ビジネスモデル
    biz_model_types: Array.isArray(row.biz_model_types) && (row.biz_model_types as string[]).length > 0
      ? (row.biz_model_types as string[])
      : null,
    biz_model_note: (row.biz_model_note as string | null) ?? null,
    // ③ 顧客・マーケット
    market_customer_size: Array.isArray(row.market_customer_size) && (row.market_customer_size as string[]).length > 0
      ? (row.market_customer_size as string[])
      : null,
    market_decision_maker: (row.market_decision_maker as string | null) ?? null,
    market_note: (row.market_note as string | null) ?? null,
    // ⑦ 資本関係・グループ
    capitalType: (row.capital_type as string | null) ?? null,
    parentCompanyName: (row.parent_company_name as string | null) ?? null,
    parentCompanyCountry: (row.parent_company_country as string | null) ?? null,
    listedExchange: (row.listed_exchange as string | null) ?? null,
    capitalNotes: (row.capital_notes as string | null) ?? null,
    globalEmployeeCount: (row.global_employee_count as string | null) ?? null,
    // ⑧ 拠点・勤務地
    headquartersAddress: (row.headquarters_address as string | null) ?? null,
    branchLocations: Array.isArray(row.branch_locations) && (row.branch_locations as string[]).length > 0
      ? (row.branch_locations as string[])
      : null,
    remoteWorkStatus: (row.remote_work_status as string | null) ?? null,
  };
}

function buildCompanyNumbers(row: Record<string, any>): CompanyNumbers {
  const rawAge = row.avg_age;
  const rawLeave = row.paid_leave_rate;
  return {
    avgSalary: typeof row.avg_salary === "string" && row.avg_salary.trim()
      ? row.avg_salary.trim()
      : null,
    avgAge: typeof rawAge === "number" ? rawAge
      : typeof rawAge === "string" && /^\d+$/.test(rawAge) ? parseInt(rawAge, 10)
      : null,
    paidLeaveRate: typeof rawLeave === "number" ? rawLeave
      : typeof rawLeave === "string" && /^\d+$/.test(rawLeave) ? parseInt(rawLeave, 10)
      : null,
    avgOvertimeHours: typeof row.avg_overtime_hours === "string" && row.avg_overtime_hours.trim()
      ? row.avg_overtime_hours.trim()
      : null,
    genderRatio: typeof row.female_ratio === "string" && row.female_ratio.trim()
      ? row.female_ratio.trim()
      : null,
    fundingTotal: typeof row.funding_total === "string" && row.funding_total.trim()
      ? row.funding_total.trim()
      : null,
  };
}

// ─── Company list row type (for /companies page) ─────────────────────────────

export type CompanyListRow = {
  id: string;
  slug: string | null;
  name: string;
  /** 英語表記の会社名（例: "Datadog Japan"） */
  name_en: string | null;
  tagline: string;
  industry: string;
  phase: string;
  /** DB上の文字列そのまま（例: "約200名", "1000名以上", "100〜300名"） */
  employee_count: string;
  /** 平均年収文字列（例: "900万円〜"） */
  avg_salary: string | null;
  location: string;
  logo_gradient: string | null;
  logo_letter: string | null;
  logo_url: string | null;
  accepting_casual_meetings: boolean;
  remote_work_status: string | null;
  is_published: boolean;
  /** 求人・面談OKを実際に表示するか（engagement_status = contracted の企業のみ true 可） */
  jobs_public: boolean;
  updated_at: string;
  job_count: number;
  /** カード上部に表示するオフィス写真 URL（ow_company_office_photos の display_order 最小のもの） */
  cover_photo_url: string | null;
  /** 会社の特徴・強みタグ（例: ["リモートファースト", "成長期"]） */
  company_features: string[] | null;
  /** ow_experiences 上のユニーク登録ユーザー数（DM可能な在籍・OB人数） */
  member_count: number;
  /** 企業Webサイト URL（Clearbit ロゴ取得に使用） */
  url: string | null;
};

const COMPANY_LISTPAGE_COLS = [
  "id", "slug", "name", "name_en", "tagline", "industry", "phase", "employee_count",
  "avg_salary", "logo_gradient", "logo_letter", "logo_url",
  "location", "url", "accepting_casual_meetings", "remote_work_status",
  "is_published", "jobs_public", "updated_at", "company_features",
].join(", ");

/**
 * Companies list for the /companies jobseeker page.
 * dev環境ではis_publishedフィルターを無効化（テストデータが少ないため全15件表示）。
 * 本番環境では is_published=true の企業のみ表示。
 */
export async function getCompaniesForList(): Promise<CompanyListRow[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ow_companies")
    .select(COMPANY_LISTPAGE_COLS)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (process.env.NODE_ENV !== "development") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("is_published", true);
  }

  const { data: companyRows, error } = await query;
  if (error) {
    console.error("[getCompaniesForList]", error.message);
    return [];
  }

  // Fetch active job counts + first office photo + registered member counts in parallel
  const [{ data: jobRows }, { data: photoRows }, { data: expRows }] = await Promise.all([
    supabase
      .from("ow_jobs")
      .select("company_id")
      .in("status", ["active", "published"]),
    supabase
      .from("ow_company_office_photos")
      .select("company_id, image_url, display_order")
      .order("display_order", { ascending: true }),
    // is_test=true ユーザーを除外するため ow_users を JOIN
    supabase
      .from("ow_experiences")
      .select("company_id, user_id, ow_users!user_id(id, is_test)")
      .eq("ow_users.is_test", false),
  ]);

  const jobCountMap = new Map<string, number>();
  for (const j of jobRows ?? []) {
    const cid = j.company_id as string;
    jobCountMap.set(cid, (jobCountMap.get(cid) ?? 0) + 1);
  }

  // 各社の最初の写真を 1 枚だけ保持（display_order 昇順なので最初に出現したもの）
  const coverPhotoMap = new Map<string, string>();
  for (const p of photoRows ?? []) {
    const cid = p.company_id as string;
    if (!coverPhotoMap.has(cid)) {
      coverPhotoMap.set(cid, p.image_url as string);
    }
  }

  // ow_experiences のユニークユーザー数（登録メンバー数）— is_test=true ユーザーを除外済み
  const memberCountMap = new Map<string, Set<string>>();
  for (const e of expRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const owUser = (e as any).ow_users;
    if (!owUser || owUser.is_test) continue;
    const cid = e.company_id as string;
    const uid = e.user_id as string;
    if (!memberCountMap.has(cid)) memberCountMap.set(cid, new Set());
    memberCountMap.get(cid)!.add(uid);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (companyRows ?? []).map((row: Record<string, any>): CompanyListRow => ({
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    name: (row.name as string) ?? "",
    name_en: (row.name_en as string) ?? null,
    tagline: (row.tagline as string) ?? "",
    industry: (row.industry as string) ?? "",
    phase: (row.phase as string) ?? "",
    employee_count: (row.employee_count as string) ?? "",
    avg_salary: (row.avg_salary as string) ?? null,
    location: (row.location as string) ?? "",
    logo_gradient: (row.logo_gradient as string) ?? null,
    logo_letter: (row.logo_letter as string) ?? null,
    logo_url: (row.logo_url as string) ?? null,
    accepting_casual_meetings: (row.accepting_casual_meetings as boolean) ?? false,
    remote_work_status: (row.remote_work_status as string) ?? null,
    is_published: (row.is_published as boolean) ?? false,
    /* ⚠️ 2026-08-06: null フォールバックを削除した。jobs_public は NOT NULL DEFAULT false
          なので null になりえず、分岐は発火しなかった。
       ⚠️ jobs_public 自体の参照は同日にゼロになっている（面談CTAは
          accepting_casual_meetings に統一）。この値を新しい判定に使わないこと。 */
    jobs_public: (row.jobs_public as boolean) ?? false,
    updated_at: (row.updated_at as string) ?? "",
    job_count: jobCountMap.get(row.id as string) ?? 0,
    cover_photo_url: coverPhotoMap.get(row.id as string) ?? null,
    company_features: Array.isArray(row.company_features) ? (row.company_features as string[]) : null,
    member_count: memberCountMap.get(row.id as string)?.size ?? 0,
    url: (row.url as string | null) ?? null,
  }));
}

// ─── Company queries ──────────────────────────────────────────────────────────

const COMPANY_LIST_COLS = [
  "id", "slug", "name", "name_en", "brand_name", "tagline", "industry", "industry_id", "saas_category_id", "phase", "employee_count",
  "logo_gradient", "logo_letter", "logo_url", "url", "accepting_casual_meetings",
  "updated_at", "remote_work_status", "flex_time", "side_job_ok",
  "description", "why_join", "benefits", "evaluation_system",
  "jobs_public", "mission", "fit_positives",
].join(", ");

const COMPANY_DETAIL_COLS = [
  ...COMPANY_LIST_COLS.split(", "),
  "mission", "description", "founded_year", "ceo_name",
  "location", "url", "company_features", "why_join",
  // Numbers section (Commit AA)
  "avg_salary", "avg_age", "paid_leave_rate",
  "avg_overtime_hours", "female_ratio", "funding_total",
  // Benefits section (Commit BB)
  "nearest_station", "work_time_system", "workstyle_description",
  "benefits", "evaluation_system",
  // Fit section
  "fit_positives", "fit_negatives", "show_fit_negatives",
  // Culture description
  "culture_description",
  // Products & Customers
  "main_products", "main_customers",
  // Numbers survey timestamp
  "numbers_updated_at",
  // Social links
  "x_url", "linkedin_url", "careers_url",
  // Org teams
  "org_teams",
  // Culture keywords
  "culture_keywords",
  // Customer cases (rich JSONB) — Migration 151 applied ✅
  "customer_cases",
  // Reality disclosure — Migration 202
  "reality_disclosure",
  // ② ビジネスモデル / ③ 顧客・マーケット — migration 20260727172428
  "biz_model_types", "biz_model_note",
  "market_customer_size", "market_decision_maker", "market_note",
  // ⑦ 資本関係・グループ — migration 20260728053104
  "capital_type", "parent_company_name", "parent_company_country",
  "listed_exchange", "capital_notes", "global_employee_count",
  // ⑧ 拠点・勤務地
  "headquarters_address", "branch_locations",
].join(", ");

export async function getCompanies(): Promise<Company[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_companies")
    .select(COMPANY_LIST_COLS)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[getCompanies]", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapCompany(row));
}

/** 同業界・異なるフェーズの類似企業を最大4件取得 */
export async function getSimilarCompanies(companyId: string, industry: string, phase: string): Promise<Company[]> {
  const supabase = createClient();
  let q = supabase
    .from("ow_companies")
    .select(COMPANY_LIST_COLS)
    .eq("industry", industry)
    .neq("id", companyId)
    .neq("phase", phase)
    .order("updated_at", { ascending: false })
    .limit(4);
  if (process.env.NODE_ENV !== "development") {
    q = q.eq("is_published", true);
  }
  const { data, error } = await q;
  if (error || !data || data.length === 0) {
    // fallback: 業界問わず異フェーズ
    let q2 = supabase
      .from("ow_companies")
      .select(COMPANY_LIST_COLS)
      .neq("id", companyId)
      .neq("phase", phase)
      .order("updated_at", { ascending: false })
      .limit(4);
    if (process.env.NODE_ENV !== "development") {
      q2 = q2.eq("is_published", true);
    }
    const { data: data2 } = await q2;
    return (data2 ?? []).map((row) => mapCompany(row));
  }
  return data.map((row) => mapCompany(row));
}

export const getCompanyById = cache(async function getCompanyById(
  id: string
): Promise<{ company: Company; detail: CompanyDetail; employeeCategories: CompanyEmployeeCategoryItem[] } | null> {
  const supabase = createAdminClient();

  let companyQuery = supabase
    .from("ow_companies")
    .select(COMPANY_DETAIL_COLS)
    .eq("id", id);
  if (process.env.NODE_ENV !== "development") {
    companyQuery = companyQuery.eq("is_published", true);
  }
  const { data, error } = await companyQuery.single();

  if (error || !data) {
    if (error?.code !== "PGRST116") console.error("[getCompanyById]", error?.message);
    return null;
  }

  // Fetch jobs + roles + employee categories + genres in parallel
  const [{ data: jobRows }, { data: roleRows }, employeeCategories, { data: genreRows }] = await Promise.all([
    supabase
      .from("ow_jobs")
      .select("id, slug, title, job_category, role_category_id, salary_min, salary_max, published_at, urgency, description, requirements, selection_process, why_hire, catch_copy, work_style, employment_type, location")
      .eq("company_id", id),
    supabase
      .from("ow_roles")
      .select("id, name, parent_id"),
    getCompanyEmployeeCategories(id),
    supabase
      .from("ow_company_genres")
      .select("ow_genres(id, name, display_order)")
      .eq("company_id", id)
      .eq("is_human_approved", true),
  ]);

  // ジャンルを display_order 順に並べて { id, name } に正規化
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genres: CompanyGenre[] = ((genreRows ?? []) as Record<string, any>[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row) => row.ow_genres as Record<string, any> | null)
    .filter((g): g is Record<string, any> => g !== null)
    .sort((a, b) => ((a.display_order as number) ?? 0) - ((b.display_order as number) ?? 0))
    .map((g) => ({ id: g.id as string, name: g.name as string }));

  const company = mapCompany(data, jobRows?.length ?? 0, genres);
  const detail = buildCompanyDetail(data, jobRows ?? [], roleRows ?? []);

  return { company, detail, employeeCategories };
});

/**
 * スラッグ or UUID どちらでも企業詳細を取得する。
 * UUID が渡された場合でも slug がある企業は slug を返す（呼び出し元で redirect する）。
 */
export async function getCompanyBySlugOrId(
  slugOrId: string
): Promise<{ company: Company; detail: CompanyDetail; employeeCategories: CompanyEmployeeCategoryItem[]; resolvedId: string; slug: string | null } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const supabase = createAdminClient();

  let idQuery = supabase
    .from("ow_companies")
    .select("id, slug")
    .limit(1);

  if (isUUID) {
    idQuery = idQuery.eq("id", slugOrId);
  } else {
    idQuery = idQuery.eq("slug", slugOrId);
  }
  if (process.env.NODE_ENV !== "development") {
    idQuery = idQuery.eq("is_published", true);
  }

  const { data: idRows } = await idQuery;
  const idRow = idRows?.[0];
  if (!idRow) return null;

  const resolvedId = idRow.id as string;
  const slug = (idRow.slug as string | null) ?? null;

  const result = await getCompanyById(resolvedId);
  if (!result) return null;

  return { ...result, resolvedId, slug };
}

/**
 * 記事の company_slug から「公開中の企業ページの URL」を解決する。
 * 該当が無ければ null（＝掲載を終えた企業、または綴り違い）。
 *
 * ── なぜ必要か（2026-08-04）────────────────────────────────────────────────
 * ow_articles.company_slug は FK ではなく自由記述のテキスト列で、
 * 企業を削除しても残る（FK の company_id は ON DELETE SET NULL で自動的に外れる）。
 * そのため記事末尾の CTA が存在しない企業ページへリンクし 404 になっていた。
 * 掲載を終えた企業（LayerX / freee / Archi Village）の記事4件が該当していた。
 *
 * ⚠️ ここでは development でも is_published を必ず見る。
 *    CLAUDE.md にあるとおり dev は通常 is_published をフィルタしないが、
 *    この関数の目的は「本番で 404 になるリンクを出さない」ことなので、
 *    dev で見えてしまうと確認にならない。dev と prod で同じ判定にする。
 *
 * 詳細は要らないので getCompanyBySlugOrId（企業詳細まで取得する）は使わない。
 */
export const resolvePublishedCompanyHref = cache(async function resolvePublishedCompanyHref(
  slugOrId: string | null | undefined
): Promise<string | null> {
  const key = (slugOrId ?? "").trim();
  if (!key) return null;

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ow_companies")
    .select("id, slug")
    .eq(isUUID ? "id" : "slug", key)
    .eq("is_published", true)
    .limit(1);

  if (error) {
    console.error("[resolvePublishedCompanyHref]", error.message);
    return null;
  }
  const row = data?.[0];
  if (!row) return null;

  return `/companies/${(row.slug as string | null) ?? (row.id as string)}`;
});

// ─── Role queries ─────────────────────────────────────────────────────────────

/** 求職者向け /jobs カテゴリピル用: ow_roles の親カテゴリ (parent_id IS NULL) を取得 */
export const getParentRoles = unstable_cache(
  async (): Promise<{ id: string; name: string }[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("ow_roles")
      .select("id, name, display_order")
      .is("parent_id", null)
      .order("display_order", { ascending: true, nullsFirst: false });
    return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string }));
  },
  ["parent-roles"],
  { revalidate: 3600 } // 1時間キャッシュ（ロールはほぼ変わらない）
);

/**
 * ow_roles を全階層まとめて取得する。
 * ow_job_roles に入るのは「具体職種」なので、9大分類に集約するには
 * 全階層が要る（最大3階層。resolveTopRole() 参照）。
 */
// ⚠️ unstable_cache は戻り値を JSON 化して保存するため、Map / Set を返すと
//    復元時に素のオブジェクトになり .get() が消える。
//    キャッシュするのは配列（JSON で往復できる形）だけにし、
//    Map の組み立てはリクエストごとに react cache() 側で行う。
const getRoleRows = unstable_cache(
  async (): Promise<RoleNode[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("ow_roles")
      .select("id, parent_id, name, slug, display_order")
      .eq("is_active", true);
    if (error) console.error("[getRoleRows]", error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      parentId: (r.parent_id as string | null) ?? null,
      name: r.name as string,
      slug: (r.slug as string | null) ?? null,
      displayOrder: (r.display_order as number | null) ?? 0,
    }));
  },
  ["role-rows"],
  { revalidate: 3600 }
);

export const getRoleTree = cache(async function getRoleTree(): Promise<RoleTree> {
  return buildRoleTree(await getRoleRows());
});

/**
 * job_id → ow_job_roles の role_id[]（is_primary が先頭）。RLS バイパス。
 *
 * ⚠️ no-store クライアントで引く。ADMIN で職種タグを付け替えたとき、
 *    fetch キャッシュに載っていると `unstable_cache` の期限が切れた後も
 *    古いタグを返し続ける（createNoStoreAdminClient のコメント参照）。
 */
export async function getJobRoleMap(jobIds?: string[]): Promise<Map<string, string[]>> {
  const admin = createNoStoreAdminClient();
  let q = admin.from("ow_job_roles").select("job_id, role_id, is_primary");
  if (jobIds && jobIds.length > 0) q = q.in("job_id", jobIds);
  const { data, error } = await q;
  if (error) console.error("[getJobRoleMap]", error.message);

  const map = new Map<string, { id: string; primary: boolean }[]>();
  for (const r of data ?? []) {
    const jid = r.job_id as string;
    if (!map.has(jid)) map.set(jid, []);
    map.get(jid)!.push({ id: r.role_id as string, primary: (r.is_primary as boolean) === true });
  }
  const out = new Map<string, string[]>();
  map.forEach((rows, jid) => {
    rows.sort((a, b) => Number(b.primary) - Number(a.primary));
    out.set(jid, rows.map((r) => r.id));
  });
  return out;
}

// ─── Job queries ──────────────────────────────────────────────────────────────

const JOB_LIST_COLS = [
  "id", "slug", "company_id", "title", "job_category", "role_category_id", "employment_type",
  // 会社独自呼称（表示専用。検索・絞り込みには使わない）
  "company_job_role_id",
  "location", "work_style", "salary_min", "salary_max",
  "catch_copy", "one_liner", "published_at", "updated_at", "remote_work_status", "urgency",
  "business_model",
  // セールス職専用項目 (Migration 212) — 一覧カードでも OTE 表示に使う
  "ote_min", "ote_max", "sales_segment",
  // 技術スタック (Migration 245)
  "tech_stack",
  // スキルタグ表示用（一覧カードで使用）
  "requirements",
].join(", ");

const JOB_DETAIL_COLS = [
  ...JOB_LIST_COLS.split(", "),
  "status", "expires_at",
  "description", "requirements", "preferred_skills", "selection_process",
  "message_to_candidates", "what_youll_do_intro", "who_we_want_intro",
  "why_hire", "team_composition", "first_90_days",
  // セールス職専用（詳細のみ）
  "sales_hunter_farmer", "incentive_note",
].join(", ");

export const getJobs = unstable_cache(
  async (): Promise<{ jobs: Job[]; companies: Company[] }> => {
    const supabase = createPublicClient();
    const admin = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jobQuery: any = supabase
      .from("ow_jobs")
      .select(JOB_LIST_COLS)
      .order("updated_at", { ascending: false });
    if (process.env.NODE_ENV !== "development") {
      jobQuery = jobQuery.in("status", ["active", "published"]);
    }

    const [{ data: jobRows, error: jobErr }, { data: compRows, error: compErr }, { data: jobRoleRows, error: jobRoleErr }, roleTree, { data: cjrRows, error: cjrErr }] = await Promise.all([
      jobQuery,
      supabase.from("ow_companies").select(COMPANY_LIST_COLS),
      /*
        ow_job_roles と会社呼称（RLS バイパス）。
        ⚠️ ここは **no-store を使わない**。この関数は unstable_cache の中にあり、
           no-store の fetch を混ぜると `/jobs/dept/[slug]` のような
           プリレンダリング対象のページで DynamicServerError になり、
           **エラーを握って空の結果を返してしまう**（2026-08-06 のビルドで実測）。
           鮮度はこの unstable_cache（revalidate 300）と、
           更新側の revalidatePath("/jobs") が担保する。
      */
      admin.from("ow_job_roles").select("job_id, role_id, is_primary"),
      getRoleTree(),
      admin.from("ow_company_job_roles").select("id, name, deleted_at"),
    ]);

    /* ⚠️ error を握らない。supabase-js は例外を投げず { error } を返すので、
          data だけ見ていると「0件」と区別がつかない。
          2026-08-06 に会社呼称が DynamicServerError で空になっていたのを
          ログでしか気づけなかったため、全クエリで出す。 */
    if (jobErr) console.error("[getJobs] jobs", jobErr.message);
    if (compErr) console.error("[getJobs] companies", compErr.message);
    if (jobRoleErr) console.error("[getJobs] job_roles", jobRoleErr.message);
    if (cjrErr) console.error("[getJobs] company_job_roles", cjrErr.message);

    // job_id → role_id[]（is_primary を先頭に）
    const jobRoleMap = new Map<string, { id: string; primary: boolean }[]>();
    for (const r of (jobRoleRows ?? [])) {
      const jid = r.job_id as string;
      if (!jobRoleMap.has(jid)) jobRoleMap.set(jid, []);
      jobRoleMap.get(jid)!.push({ id: r.role_id as string, primary: (r.is_primary as boolean) === true });
    }

    const cjrMap = new Map(
      (cjrRows ?? []).map((r) => [r.id as string, { name: r.name as string, deleted_at: r.deleted_at as string | null }])
    );

    const companies = (compRows ?? []).map((row) => mapCompany(row));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs = (jobRows ?? []).map((row: Record<string, any>) => {
      const job = mapJob(row);
      const rows = jobRoleMap.get(job.id);
      if (rows && rows.length > 0) {
        rows.sort((a, b) => Number(b.primary) - Number(a.primary));
        const own = rows.map((r) => r.id);

        // roleIds には「求人に紐づく具体職種」＋「その祖先」を入れる。
        // ow_job_roles にはピッカーで選ばれた具体職種（例: セールスエンジニア）が
        // 入るため、9大分類（例: 営業）で絞り込むフィルタは祖先まで展開しないと
        // ヒットしない。祖先を含めておけば、大分類でも子階層でも同じ判定で通る。
        const expanded = new Set(own);
        for (const id of own) {
          let node = roleTree.byId.get(id) ?? null;
          const seen = new Set<string>();
          while (node?.parentId && !seen.has(node.id)) {
            seen.add(node.id);
            expanded.add(node.parentId);
            node = roleTree.byId.get(node.parentId) ?? null;
          }
        }
        job.roleIds = Array.from(expanded);
        // 標準職種名は primary の具体職種名（祖先ではなく、選ばれたそのもの）
        job.roleName = roleTree.byId.get(own[0])?.name ?? null;
      }
      // 求職者に見せる職種名。会社呼称 ?? 標準職種名
      const cjr = row.company_job_role_id ? cjrMap.get(row.company_job_role_id as string) : null;
      job.companyRoleName = cjr?.deleted_at ? null : cjr?.name ?? null;
      job.roleLabel = pickRoleLabel({
        companyRoleName: cjr?.name, companyRoleDeletedAt: cjr?.deleted_at, standardRoleName: job.roleName,
      });
      return job;
    });

    return { jobs, companies };
  },
  ["jobs-list"],
  { revalidate: 300 }
);

// ─── Position Members ─────────────────────────────────────────────────────────

export type JobPositionMember = {
  userId: string;
  name: string;
  roleTitle: string;
  isCurrent: boolean;
  photoUrl: string | null;
  gradient: string;
  initial: string;
};

// ow_jobs.job_category (text) → ow_roles.id[]
// 一般的な職種名と role_category_id の対応マップ
const JOB_CATEGORY_ROLE_MAP: Record<string, string[]> = {
  "エンタープライズ営業": ["133c74c0-e432-4c52-8235-7ad9bc7d96b8", "6938712f-0b29-4682-ac6e-ad112734a3f1"],
  "セールス": ["133c74c0-e432-4c52-8235-7ad9bc7d96b8", "6938712f-0b29-4682-ac6e-ad112734a3f1", "d1724303-7ca2-4cbe-a16b-f15d5a2476b8"],
  "SMB営業": ["d1724303-7ca2-4cbe-a16b-f15d5a2476b8", "6938712f-0b29-4682-ac6e-ad112734a3f1"],
  "フィールドセールス": ["133c74c0-e432-4c52-8235-7ad9bc7d96b8", "6938712f-0b29-4682-ac6e-ad112734a3f1"],
  "インサイドセールス": ["d1724303-7ca2-4cbe-a16b-f15d5a2476b8", "6938712f-0b29-4682-ac6e-ad112734a3f1"],
  "カスタマーサクセス": ["ad47e554-e328-4aec-abd1-dab9953ddf9d"],
  "セールスエンジニア": ["133c74c0-e432-4c52-8235-7ad9bc7d96b8", "c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "ソリューションエンジニア": ["133c74c0-e432-4c52-8235-7ad9bc7d96b8", "c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "ソリューションズアーキテクト": ["133c74c0-e432-4c52-8235-7ad9bc7d96b8", "c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "プロダクトマネージャー": ["669c6a08-997a-4a3f-b588-762acffacbc4", "168cd1ab-d096-46cc-ad7e-5baf7f10a0b1"],
  "バックエンドエンジニア": ["2e9ea870-9e0a-4ae5-b75f-b50edae9a6e4", "c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "ソフトウェアエンジニア": ["c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "フロントエンドエンジニア": ["dfadc9b0-2739-4e4b-881f-8a44065b5d1b", "c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "MLエンジニア": ["c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "リサーチエンジニア": ["c8140123-e29a-43b3-9dbf-1a3d21a68966"],
  "プロダクトデザイナー": ["9f8deb80-3c93-450b-ad30-dfab90430ea4"],
  "ビジネスオペレーション": ["b49b9bc8-488b-47a5-80b0-9eba4869e910", "23e79605-332b-485d-98c2-d162a491a409"],
};

export async function getJobPositionMembers(jobCategory: string): Promise<JobPositionMember[]> {
  const roleIds = JOB_CATEGORY_ROLE_MAP[jobCategory];
  if (!roleIds || roleIds.length === 0) return [];

  const supabase = createClient();

  const { data: expRows } = await supabase
    .from("ow_experiences")
    .select("user_id, role_title, is_current, role_category_id, ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_test)")
    .in("role_category_id", roleIds);

  if (!expRows || expRows.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expData = expRows as Record<string, any>[];

  const seen = new Set<string>();
  const result: JobPositionMember[] = [];

  for (const exp of expData) {
    const user = exp.ow_users as Record<string, any> | null;
    if (!user || user.visibility !== "public") continue;
    if ((user.is_test as boolean | null) === true) continue;
    const uid = user.id as string;
    if (seen.has(uid)) continue;
    seen.add(uid);
    const name = (user.name as string) ?? "—";
    const avatarColor = user.avatar_color as string | null;
    const avatarUrl = user.avatar_url as string | null;
    result.push({
      userId: uid,
      name,
      roleTitle: (exp.role_title as string) ?? "",
      isCurrent: (exp.is_current as boolean) ?? false,
      photoUrl: avatarUrl,
      gradient: avatarColor?.startsWith("linear-gradient") ? avatarColor : FALLBACK_GRADIENT,
      initial: name.charAt(0),
    });
    if (result.length >= 6) break;
  }

  return result;
}


export const getJobById = cache(async function getJobById(
  id: string
): Promise<{ job: Job; company: Company; relatedJobs: Job[] } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ow_jobs")
    .select(JOB_DETAIL_COLS)
    .eq("id", id)
    .in("status", ["active", "published"])
    .single();

  if (error || !data) {
    if (error?.code !== "PGRST116") console.error("[getJobById]", error?.message);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobRow = data as Record<string, any>;

  const [{ data: compData, error: compErr }, { data: relatedRows }] = await Promise.all([
    supabase
      .from("ow_companies")
      .select(COMPANY_LIST_COLS)
      .eq("id", jobRow.company_id)
      .single(),
    supabase
      .from("ow_jobs")
      .select("id, title, job_category, role_category_id, salary_min, salary_max, published_at, updated_at")
      .eq("company_id", jobRow.company_id)
      .in("status", ["active", "published"])
      .neq("id", jobRow.id)
      .limit(3),
  ]);

  if (compErr || !compData) {
    console.error("[getJobById] company not found for", jobRow.company_id);
    return null;
  }
  const relatedJobs: Job[] = (relatedRows ?? []).map((r) => mapJob(r as Record<string, unknown>));

  // 職種は ow_job_roles が正。詳細ページでも roleIds / roleName を使えるようにする
  // （job_category は移行期間中の派生値で、判定には使わない）。
  const job = mapJob(jobRow);
  const [roleMap, roleTree] = await Promise.all([getJobRoleMap([job.id]), getRoleTree()]);
  const own = roleMap.get(job.id) ?? [];
  if (own.length > 0) {
    const expanded = new Set(own);
    for (const rid of own) {
      let node = roleTree.byId.get(rid) ?? null;
      const seen = new Set<string>();
      while (node?.parentId && !seen.has(node.id)) {
        seen.add(node.id);
        expanded.add(node.parentId);
        node = roleTree.byId.get(node.parentId) ?? null;
      }
    }
    job.roleIds = Array.from(expanded);
    job.roleName = roleTree.byId.get(own[0])?.name ?? null;
  }

  // 求職者に見せる職種名。会社呼称 ?? 標準職種名
  if (jobRow.company_job_role_id) {
    /* ⚠️ 呼称が引けなかった場合、fetchCompanyRoleMap が空の Map を返すので
          ここは黙って標準職種名にフォールバックする。
          「呼称を消した」のか「引けなかった」のか区別できないため、
          引けなかったことが分かるようにログを出す。 */
    const map = await fetchCompanyRoleMap();
    if (map.size === 0) {
      console.error("[getJobById] 会社呼称を1件も引けなかった。job:", jobRow.id, "cjr:", jobRow.company_job_role_id);
    }
    const cjr = map.get(jobRow.company_job_role_id as string);
    job.companyRoleName = cjr?.deleted_at ? null : cjr?.name ?? null;
    job.roleLabel = pickRoleLabel({
      companyRoleName: cjr?.name, companyRoleDeletedAt: cjr?.deleted_at, standardRoleName: job.roleName,
    });
  } else {
    job.roleLabel = pickRoleLabel({ standardRoleName: job.roleName });
  }

  return {
    job,
    company: mapCompany(compData),
    relatedJobs,
  };
});

export async function getJobBySlugOrId(
  slugOrId: string
): Promise<{ job: Job; company: Company; relatedJobs: Job[]; resolvedId: string; slug: string | null } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const supabase = createAdminClient();

  let idQuery = supabase.from("ow_jobs").select("id, slug").in("status", ["active", "published"]).limit(1);
  if (isUUID) { idQuery = idQuery.eq("id", slugOrId); }
  else { idQuery = idQuery.eq("slug", slugOrId); }

  const { data: idRows } = await idQuery;
  const idRow = idRows?.[0];
  if (!idRow) return null;

  const resolvedId = idRow.id as string;
  const slug = (idRow.slug as string | null) ?? null;

  const result = await getJobById(resolvedId);
  if (!result) return null;
  return { ...result, resolvedId, slug };
}

// ─── Company photos ───────────────────────────────────────────────────────────

export type CompanyPhoto = {
  id: string;
  image_url: string;
  category: string | null;
  caption: string | null;
  display_order: number;
  tagged_user_id: string | null;
  tagged_user: { id: string; name: string } | null;
};

export async function getCompanyPhotos(companyId: string): Promise<CompanyPhoto[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ow_company_office_photos")
    .select("id, image_url, category, caption, display_order, tagged_user_id")
    .eq("company_id", companyId)
    .order("display_order", { ascending: true })
    .limit(20);
  if (error) {
    console.error("[getCompanyPhotos]", error.message);
    return [];
  }

  // Fetch tagged user info in a single batch query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taggedUserIds = (data ?? []).map((r: any) => r.tagged_user_id).filter((id: unknown): id is string => !!id);
  const userMap = new Map<string, { id: string; name: string }>();
  if (taggedUserIds.length > 0) {
    const { data: users } = await supabase
      .from("ow_users")
      .select("id, name")
      .in("id", taggedUserIds)
      .eq("is_test", false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (users ?? []).forEach((u: any) => userMap.set(u.id as string, { id: u.id as string, name: (u.name as string) ?? "" }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: Record<string, any>): CompanyPhoto => ({
    id: row.id as string,
    image_url: row.image_url as string,
    category: (row.category as string) ?? null,
    caption: (row.caption as string) ?? null,
    display_order: (row.display_order as number) ?? 0,
    tagged_user_id: (row.tagged_user_id as string) ?? null,
    tagged_user: row.tagged_user_id ? (userMap.get(row.tagged_user_id as string) ?? null) : null,
  }));
}

// ─── Company recruiters ───────────────────────────────────────────────────────

export type CompanyRecruiter = {
  id: string;
  name: string;
  avatar_initial: string;
  avatar_color: string | null;
  department: string | null;
  role_title: string | null;
  catchphrase: string | null;
};

export async function getCompanyRecruiters(companyId: string): Promise<CompanyRecruiter[]> {
  const supabase = createAdminClient();

  const { data: adminRows, error } = await supabase
    .from("ow_company_admins")
    .select("id, user_id, department, role_title, permission")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (error || !adminRows?.length) {
    if (error) console.error("[getCompanyRecruiters]", error.message);
    return [];
  }

  // admin first, then member
  adminRows.sort((a, b) => {
    if (a.permission === "admin" && b.permission !== "admin") return -1;
    if (a.permission !== "admin" && b.permission === "admin") return 1;
    return 0;
  });

  const userIds = adminRows.map((r) => r.user_id as string).filter(Boolean);
  if (userIds.length === 0) return [];

  const { data: userRows } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, catchphrase")
    .in("id", userIds)
    .eq("is_test", false);

  const userMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userRows ?? []).map((u: Record<string, any>) => [u.id as string, u])
  );

  // 案A: userMap に存在しないエントリー（is_test=true のユーザー等）を除外
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return adminRows.filter((row: Record<string, any>) =>
    userMap.has(row.user_id as string)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).map((row: Record<string, any>): CompanyRecruiter => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = userMap.get(row.user_id as string) as Record<string, any>;
    const name = (user.name as string) ?? "担当者";
    return {
      id: row.id as string,
      name,
      avatar_initial: name.charAt(0),
      avatar_color: (user.avatar_color as string) ?? null,
      department: (row.department as string) ?? null,
      role_title: (row.role_title as string) ?? null,
      catchphrase: (user.catchphrase as string) ?? null,
    };
  });
}

// ─── Company employees (ow_experiences → ow_users) ───────────────────────────

export type CompanyEmployee = {
  userId: string;
  name: string;
  avatarInitial: string;
  avatarGradient: string;
  avatarUrl: string | null; // プロフィール写真
  birthYear: number | null; // 生年（年齢計算用）
  roleTitle: string | null;
  startedAt: string | null; // "YYYY-MM" 形式
  endedAt: string | null;   // "YYYY-MM" 形式、OB のみ使用
  // === Phase Q-5 追加: カテゴリ情報 ===
  roleCategoryId: string | null;
  roleCategoryName: string | null;
  roleParentId: string | null;
  roleParentName: string | null;
  // === Migration 160: カジュアル面談受付フラグ ===
  canCasualMeeting: boolean;
  // === OB/OG: 退職後の現在のキャリア ===
  currentRoleTitle: string | null;
  currentCompanyName: string | null;
  currentCompanyBrandName: string | null;
  // === Session 9: 一言コメント ===
  catchphrase: string | null;
  // ページ側でログイン状態によるフィルタに使用
  visibility: "public" | "login_only";
};

export async function getCompanyEmployees(companyId: string): Promise<{
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
}> {
  const supabase = createAdminClient();
  const EMPTY = { current: [], alumni: [] };

  // 全 ow_roles を取得 (カテゴリ名・親情報解決用)
  const { data: allRoles } = await supabase
    .from("ow_roles")
    .select("id, name, parent_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleMap = new Map<string, Record<string, any>>(
    (allRoles ?? []).map((r) => [r.id as string, r])
  );

  // 企業が非表示にした experience_id を取得
  const { data: hiddenRows } = await supabase
    .from("ow_company_hidden_experiences")
    .select("experience_id")
    .eq("company_id", companyId);
  const hiddenIds = (hiddenRows ?? []).map((r) => r.experience_id as string);

  // 現役社員 (is_current = true)
  // visibility_company='hidden' は本人が「経歴に含めない」を選んだ状態。
  // 企業側の掲載要望より本人の非公開希望を優先する（ow_career_profiles の
  // RLS が「矛盾したら厳しい方を採用」で設計されているのに揃える）。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentQuery: any = supabase
    .from("ow_experiences")
    .select("id, role_title, role_category_id, ow_users!inner(id, name, avatar_color, avatar_url, can_casual_meeting, catchphrase, is_test, visibility, birth_date)")
    .eq("company_id", companyId)
    .eq("is_current", true)
    .neq("visibility_company", "hidden");
  if (hiddenIds.length > 0) {
    currentQuery = currentQuery.not("id", "in", `(${hiddenIds.join(",")})`);
  }
  const { data: currentRows, error: e1 } = await currentQuery;

  if (e1) {
    console.error("[getCompanyEmployees current]", e1.message);
    return EMPTY;
  }

  // OB 社員 (is_current = false, ended_at あり)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let alumniQuery: any = supabase
    .from("ow_experiences")
    .select("id, role_title, role_category_id, started_at, ended_at, ow_users!inner(id, name, avatar_color, avatar_url, can_casual_meeting, catchphrase, is_test, visibility, birth_date)")
    .eq("company_id", companyId)
    .eq("is_current", false)
    .neq("visibility_company", "hidden")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false });
  if (hiddenIds.length > 0) {
    alumniQuery = alumniQuery.not("id", "in", `(${hiddenIds.join(",")})`);
  }
  const { data: alumniRows, error: e2 } = await alumniQuery;

  if (e2) {
    console.error("[getCompanyEmployees alumni]", e2.message);
    return EMPTY;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapEmp(row: Record<string, any>, endedAt?: string | null, startedAt?: string | null): CompanyEmployee {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = row.ow_users as Record<string, any>;
    const name = (u?.name as string) ?? "—";
    const hex = u?.avatar_color as string | null;
    const roleCategoryId = (row.role_category_id as string | null) ?? null;
    const role = roleCategoryId ? roleMap.get(roleCategoryId) : null;
    const parent = role?.parent_id ? roleMap.get(role.parent_id as string) : null;
    return {
      userId: u?.id as string,
      name,
      avatarInitial: name.charAt(0),
      avatarGradient: hex
        ? `linear-gradient(135deg, ${hex}99, ${hex})`
        : "linear-gradient(135deg, var(--royal), #3B5FD9)",
      avatarUrl: (u?.avatar_url as string | null) ?? null,
      birthYear: u?.birth_date ? parseInt((u.birth_date as string).slice(0, 4)) : null,
      roleTitle: (row.role_title as string | null) ?? null,
      startedAt: startedAt ? (startedAt as string).slice(0, 7) : null,
      endedAt: endedAt ? (endedAt as string).slice(0, 7) : null,
      roleCategoryId,
      roleCategoryName: (role?.name as string | null) ?? null,
      roleParentId: (role?.parent_id as string | null) ?? null,
      roleParentName: (parent?.name as string | null) ?? null,
      canCasualMeeting: (u?.can_casual_meeting as boolean) ?? false,
      currentRoleTitle: null,        // 退職後キャリア: 後で補完
      currentCompanyName: null,      // 退職後キャリア: 後で補完
      currentCompanyBrandName: null, // 退職後キャリア: 後で補完
      catchphrase: (u?.catchphrase as string | null) ?? null,
      visibility: ((u?.visibility as string | null) === "login_only" ? "login_only" : "public") as "public" | "login_only",
    };
  }

  // 同一ユーザーが複数職歴を持つ場合は1人1エントリに絞る（ended_at DESC 順なので最新ロールが先頭）
  const dedupeByUser = (emps: CompanyEmployee[]): CompanyEmployee[] => {
    const seen = new Set<string>();
    return emps.filter((e) => {
      if (seen.has(e.userId)) return false;
      seen.add(e.userId);
      return true;
    });
  };

  // 表示除外条件: is_test=true または visibility='private'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSeedRow = (r: any) => {
    const u = r.ow_users as { is_test?: boolean | null; visibility?: string | null } | null;
    return u?.is_test === true || u?.visibility === "private";
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentEmps = dedupeByUser((currentRows ?? []).filter((r: any) => !isSeedRow(r)).map((r: any) => mapEmp(r)));
  // 現役社員と同一ユーザーはOB/OGから除外（同じ企業に過去在籍歴があっても現役優先）
  const currentUserIds = new Set(currentEmps.map((e) => e.userId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alumniEmps  = dedupeByUser((alumniRows ?? []).filter((r: any) => !isSeedRow(r)).map((r: any) => mapEmp(r, r.ended_at, r.started_at)))
    .filter((e) => !currentUserIds.has(e.userId));

  // OB/OG の「退職後の現在キャリア」を取得（is_current=true の経験から）
  if (alumniEmps.length > 0) {
    const alumniUserIds = alumniEmps.map((e) => e.userId);
    const { data: currentExpRows } = await supabase
      .from("ow_experiences")
      .select("user_id, role_title, company_text, ow_companies(name, brand_name)")
      .in("user_id", alumniUserIds)
      .eq("is_current", true);

    if (currentExpRows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextMap = new Map<string, { roleTitle: string | null; companyName: string | null; companyBrandName: string | null }>();
      for (const row of currentExpRows) {
        const uid = row.user_id as string;
        if (!nextMap.has(uid)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const co = row.ow_companies as Record<string, any> | null;
          nextMap.set(uid, {
            roleTitle: (row.role_title as string | null) ?? null,
            companyName: (co?.name as string | null) ?? (row.company_text as string | null) ?? null,
            companyBrandName: (co?.brand_name as string | null) ?? null,
          });
        }
      }
      for (const emp of alumniEmps) {
        const next = nextMap.get(emp.userId);
        if (next) {
          emp.currentRoleTitle = next.roleTitle;
          emp.currentCompanyName = next.companyName;
          emp.currentCompanyBrandName = next.companyBrandName;
        }
      }
    }
  }

  return { current: currentEmps, alumni: alumniEmps };
}

/**
 * 求人詳細ページ用: 同社 × 同ロールカテゴリの社員・OBOG を取得
 * roleCategoryId が null の場合は company 全員を返す（フォールバック）
 */
export async function getJobEmployees(
  companyId: string,
  roleCategoryId: string | null
): Promise<{ current: CompanyEmployee[]; alumni: CompanyEmployee[] }> {
  const all = await getCompanyEmployees(companyId);
  if (!roleCategoryId) return all;

  const matchRole = (emp: CompanyEmployee) =>
    emp.roleCategoryId === roleCategoryId ||
    emp.roleParentId === roleCategoryId;

  const current = all.current.filter(matchRole);
  const alumni  = all.alumni.filter(matchRole);

  // roleCategoryId が設定されている場合は厳密マッチのみ返す（一致なし → 空）
  return { current, alumni };
}

// キャッシュ済みバリアント（ページ速度改善用）
export const getCompanyPhotosCached = unstable_cache(
  getCompanyPhotos,
  ["company-photos"],
  { revalidate: 300 }
);

export const getCompanyRecruitersCached = unstable_cache(
  getCompanyRecruiters,
  ["company-recruiters"],
  { revalidate: 300 }
);

export const getCompanyEmployeesCached = (companyId: string) =>
  unstable_cache(
    () => getCompanyEmployees(companyId),
    ["company-employees", companyId],
    { revalidate: 120 }
  )();

// ─── Company employee categories (ow_company_employee_categories) ─────────────

/** Phase Q: 各企業のカテゴリ表示設定 (display_order 順) */
export type CompanyEmployeeCategoryItem = {
  id: string;
  roleId: string | null;
  roleName: string;
  customName: string | null;
  parentRoleId: string | null;
  parentId: string | null;
  parentName: string | null;
  displayOrder: number;
};

export async function getCompanyEmployeeCategories(
  companyId: string
): Promise<CompanyEmployeeCategoryItem[]> {
  // admin client を使用: FK 制約不在による embedded join 失敗を回避
  const admin = createAdminClient();

  const [catResult, rolesResult] = await Promise.all([
    admin
      .from("ow_company_employee_categories")
      .select("id, role_id, display_order, custom_name, parent_role_id")
      .eq("company_id", companyId)
      .order("display_order"),
    admin
      .from("ow_roles")
      .select("id, name, parent_id"),
  ]);

  if (catResult.error || !catResult.data) {
    if (catResult.error) console.error("[getCompanyEmployeeCategories]", catResult.error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleMap = new Map<string, Record<string, any>>(
    (rolesResult.data ?? []).map((r) => [r.id as string, r])
  );

  return catResult.data.map((item) => {
    const roleId = (item.role_id as string | null) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = roleId ? roleMap.get(roleId) as Record<string, any> | undefined : undefined;
    const customName = (item.custom_name as string | null) ?? null;
    const parentRoleId = (item.parent_role_id as string | null) ?? null;

    // 親の解決: 通常ロールは ow_roles.parent_id、カスタムカテゴリは parent_role_id
    const resolvedParentId = (role?.parent_id as string | null) ?? parentRoleId ?? null;
    const parent = resolvedParentId ? roleMap.get(resolvedParentId) : null;

    return {
      id: item.id as string,
      roleId,
      roleName: customName ?? (role?.name as string) ?? "",
      customName,
      parentRoleId,
      parentId: resolvedParentId ?? null,
      parentName: (parent?.name as string | null) ?? null,
      displayOrder: item.display_order as number,
    };
  });
}

// ─── Roles (BIZ category editor 用) ──────────────────────────────────────────

/** Phase Q-BIZ: カテゴリ追加モーダル用 — 全 ow_roles を取得 (親・子含む) */
export type RoleForEditor = {
  id: string;
  name: string;
  parentId: string | null;
  displayOrder: number;
};

export async function getAllRolesForCategoryEditor(): Promise<RoleForEditor[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_roles")
    .select("id, name, parent_id, display_order")
    .order("display_order", { ascending: true, nullsFirst: false });

  if (error || !data) {
    if (error) console.error("[getAllRolesForCategoryEditor]", error.message);
    return [];
  }

  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    parentId: (r.parent_id as string | null) ?? null,
    displayOrder: (r.display_order as number) ?? 0,
  }));
}

// ─── Articles ─────────────────────────────────────────────────────────────────
// Note: uses ow_articles table (migration 046)

const ARTICLE_LIST_COLS = [
  "slug", "type", "title", "subtitle", "eyecatch_gradient", "read_min",
  "published_at", "company_slug", "company_name_text",
  "company_initial_text", "company_gradient_text",
  "subject_freeze", "subjects_freeze",
].join(", ");

const ARTICLE_DETAIL_COLS = [
  ARTICLE_LIST_COLS,
  "editor_note", "body_blocks", "quote", "qa_blocks",
  "themes_blocks", "chapters", "editor_outro",
  "related_job_ids", "related_article_slugs",
].join(", ");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbArticle(row: Record<string, any>): Article {
  const publishedAt = row.published_at as string | null;
  const date = publishedAt ? publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);

  return {
    slug: row.slug as string,
    type: row.type as "employee" | "mentor" | "ceo" | "report",
    title: row.title as string,
    subtitle: (row.subtitle as string) ?? "",
    date,
    read_min: (row.read_min as number) ?? 5,
    // company_id is used in URL fragments; we store the slug for display linking
    company_id: (row.company_slug as string) ?? "",
    company_name: (row.company_name_text as string) ?? "",
    company_initial: (row.company_initial_text as string) ?? "",
    company_gradient: (row.company_gradient_text as string) ?? FALLBACK_GRADIENT,
    eyecatch_gradient: (row.eyecatch_gradient as string) ?? FALLBACK_GRADIENT,
    subject: row.subject_freeze
      ? (row.subject_freeze as ArticleSubject)
      : undefined,
    subjects: row.subjects_freeze
      ? (row.subjects_freeze as ArticleSubject[])
      : undefined,
    editor_note: (row.editor_note as string | null) ?? undefined,
    body: row.body_blocks ? (row.body_blocks as string[]) : undefined,
    quote: (row.quote as string | null) ?? undefined,
    qa: row.qa_blocks ? (row.qa_blocks as QA[]) : undefined,
    themes: row.themes_blocks ? (row.themes_blocks as ThemeItem[]) : undefined,
    chapters: row.chapters ? (row.chapters as Chapter[]) : undefined,
    editor_outro: (row.editor_outro as string | null) ?? undefined,
    related_job_ids: (row.related_job_ids as string[] | null) ?? [],
    related_article_slugs: (row.related_article_slugs as string[] | null) ?? [],
  };
}

export type ArticleFilter = { type?: string; sort?: string; q?: string };

// 全記事を一括取得してキャッシュ（フィルターはアプリ側で適用）
const getAllArticlesCached = unstable_cache(
  async (): Promise<Article[]> => {
    const supabase = createPublicClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from("ow_articles")
      .select(ARTICLE_LIST_COLS)
      .order("published_at", { ascending: false });
    if (process.env.NODE_ENV !== "development") {
      query = query.eq("is_published", true);
    }
    const { data, error } = await query;
    if (error) {
      console.warn("[getArticles] falling back to mock:", error.message);
      return [...MOCK_ARTICLES];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: Record<string, any>) => mapDbArticle(row));
  },
  ["articles-all"],
  { revalidate: 300 }
);

export async function getArticles(filter?: ArticleFilter): Promise<Article[]> {
  let articles = await getAllArticlesCached();

  if (filter?.type && filter.type !== "all") {
    articles = articles.filter((a) => a.type === filter!.type);
  }
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    articles = articles.filter((a: Article) =>
      a.title.toLowerCase().includes(q) ||
      (a.company_name ?? "").toLowerCase().includes(q) ||
      (a.subtitle ?? "").toLowerCase().includes(q)
    );
  }
  if (filter?.sort === "popular") {
    articles = [...articles].sort((a: Article, b: Article) => b.read_min - a.read_min);
  }

  return articles;
}

export const getArticleBySlug = cache(async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ow_articles")
    .select(ARTICLE_DETAIL_COLS)
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      // ow_articles テーブル未作成の場合は mock にフォールバック
      console.warn("[getArticleBySlug] falling back to mock:", error.message);
      return MOCK_ARTICLES.find((a) => a.slug === slug) ?? null;
    }
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapDbArticle(data as Record<string, any>);
});

export async function getArticlesByCompany(companyId: string): Promise<Article[]> {
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("ow_articles")
    .select(ARTICLE_LIST_COLS)
    .eq("company_id", companyId)
    .order("published_at", { ascending: false });

  if (process.env.NODE_ENV !== "development") {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) {
    // ow_articles テーブル未作成の場合は mock にフォールバック
    console.warn("[getArticlesByCompany] falling back to mock:", error.message);
    return MOCK_ARTICLES.filter((a) => a.company_id === companyId);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: Record<string, any>) => mapDbArticle(row));
}

export async function getArticlesBySlugs(slugs: string[]): Promise<Article[]> {
  if (slugs.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_articles")
    .select(ARTICLE_LIST_COLS)
    .in("slug", slugs);

  if (error) {
    // ow_articles テーブル未作成の場合は mock にフォールバック
    console.warn("[getArticlesBySlugs] falling back to mock:", error.message);
    const mockMap = new Map(MOCK_ARTICLES.map((a) => [a.slug, a]));
    return slugs.map((s) => mockMap.get(s)).filter((a): a is Article => a !== undefined);
  }

  // Preserve original order from slugs array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const articleMap = new Map<string, Article>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((row: Record<string, any>) => {
      const a = mapDbArticle(row);
      return [a.slug, a];
    })
  );
  return slugs
    .map((s) => articleMap.get(s))
    .filter((a): a is Article => a !== undefined);
}

// ── Job alumni map (role-aware: matches ow_experiences by role category) ────────

export type CompanyAlumniPreview = {
  userId: string;
  name: string;
  gradient: string;
};

export type JobAlumniInput = {
  jobId: string;
  companyId: string;
  jobCategory: string | null;
};

// Maps ow_jobs.job_category → ow_roles.name(s) to match (self or parent)
const JOB_TO_ROLE_NAMES: Record<string, string[]> = {
  "セールス":                     ["インサイドセールス", "フィールドセールス"],
  "エンタープライズ営業":         ["フィールドセールス"],
  "SMB営業":                      ["インサイドセールス"],
  "セールスエンジニア":           ["フィールドセールス"],
  "ソリューションエンジニア":     ["フィールドセールス"],
  "ソリューションズアーキテクト": ["フィールドセールス"],
  "アライアンス・パートナー":     ["フィールドセールス", "事業開発"],
  "セールス戦略・オペレーション": ["インサイドセールス", "フィールドセールス"],
  "コンサルタント":               ["フィールドセールス", "カスタマーサクセス"],
  "プロフェッショナルサービス":   ["カスタマーサクセス"],
  "カスタマーサクセス":           ["カスタマーサクセス"],
  "テクニカルサポート":           ["カスタマーサクセス"],
  "マーケティング":               ["マーケティング"],
  "プロダクトマネージャー":       ["プロダクト"],
  "バックエンドエンジニア":       ["エンジニア"],
  "ソフトウェアエンジニア":       ["エンジニア"],
  "MLエンジニア":                 ["エンジニア"],
  "リサーチエンジニア":           ["エンジニア"],
  "AI・Agentforce":               ["エンジニア"],
  "データ・アナリスト":           ["エンジニア"],
  "人事・HR":                     ["コーポレート"],
  "ビジネスオペレーション":       ["コーポレート"],
  "事業戦略・開発":               ["事業開発"],
  "プロダクトデザイナー":         ["デザイナー"],
};

export async function getJobAlumniMap(
  jobs: JobAlumniInput[]
): Promise<Record<string, CompanyAlumniPreview[]>> {
  if (!jobs.length) return {};
  const supabase = createPublicClient();

  const companyIds = Array.from(new Set(jobs.map((j) => j.companyId).filter(Boolean)));
  if (!companyIds.length) return {};

  // 1. Fetch experiences with role_category_id
  const { data: expRows } = await supabase
    .from("ow_experiences")
    .select("company_id, user_id, role_category_id")
    .in("company_id", companyIds);

  if (!expRows?.length) return {};

  // 2. Fetch all roles (small table, ~11 rows)
  const { data: allRoles } = await supabase
    .from("ow_roles")
    .select("id, name, parent_id");

  const rolesById = new Map<string, { name: string; parentId: string | null }>();
  for (const r of (allRoles ?? []) as { id: string; name: string; parent_id: string | null }[]) {
    rolesById.set(r.id, { name: r.name, parentId: r.parent_id });
  }

  // 3. Fetch user info
  const userIds = Array.from(new Set((expRows as { user_id: string }[]).map((e) => e.user_id)));
  const { data: users } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color")
    .in("id", userIds)
    .eq("visibility", "public")
    .not("name", "is", null)
    .eq("is_test", false);

  if (!users?.length) return {};

  const userMap = new Map(
    (users as { id: string; name: string; avatar_color: string | null }[]).map((u) => [u.id, u])
  );

  // 4. Build per-company experience list with role name chain (self + parent)
  type ExpInfo = { userId: string; roleChain: string[] };
  const companyExpMap = new Map<string, ExpInfo[]>();

  for (const exp of expRows as {
    company_id: string;
    user_id: string;
    role_category_id: string | null;
  }[]) {
    if (!userMap.has(exp.user_id)) continue;

    const roleChain: string[] = [];
    if (exp.role_category_id) {
      const role = rolesById.get(exp.role_category_id);
      if (role) {
        roleChain.push(role.name);
        if (role.parentId) {
          const parent = rolesById.get(role.parentId);
          if (parent) roleChain.push(parent.name);
        }
      }
    }

    const list = companyExpMap.get(exp.company_id) ?? [];
    list.push({ userId: exp.user_id, roleChain });
    companyExpMap.set(exp.company_id, list);
  }

  // 5. Build per-job alumni (role-filtered, fallback to all company alumni)
  const result: Record<string, CompanyAlumniPreview[]> = {};

  for (const job of jobs) {
    const exps = companyExpMap.get(job.companyId) ?? [];
    if (!exps.length) continue;

    const targetRoles = job.jobCategory ? (JOB_TO_ROLE_NAMES[job.jobCategory] ?? null) : null;

    let matchedIds: string[];
    if (targetRoles?.length) {
      const matched = exps.filter((e) =>
        e.roleChain.some((rn) => targetRoles.includes(rn))
      );
      // Role-matched alumni first; fall back to all company alumni if no match
      matchedIds = matched.length > 0
        ? Array.from(new Set(matched.map((e) => e.userId)))
        : Array.from(new Set(exps.map((e) => e.userId)));
    } else {
      matchedIds = Array.from(new Set(exps.map((e) => e.userId)));
    }

    const alumni = matchedIds
      .map((uid) => {
        const u = userMap.get(uid);
        if (!u) return null;
        return { userId: uid, name: u.name, gradient: u.avatar_color ?? FALLBACK_GRADIENT } as CompanyAlumniPreview;
      })
      .filter((a): a is CompanyAlumniPreview => a !== null);

    if (alumni.length > 0) result[job.jobId] = alumni;
  }

  return result;
}

// ─── Company Review Summaries ──────────────────────────────────────────────────

export type CompanyReviewSummary = {
  avg: number;
  count: number;
};

export async function getCompanyReviewSummaries(): Promise<Record<string, CompanyReviewSummary>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ow_company_reviews")
    .select("company_id, rating_overall")
    .eq("is_approved", true);

  if (!data || data.length === 0) return {};

  const map: Record<string, { sum: number; count: number }> = {};
  for (const row of data) {
    if (!row.company_id || !row.rating_overall) continue;
    if (!map[row.company_id]) map[row.company_id] = { sum: 0, count: 0 };
    map[row.company_id].sum += row.rating_overall;
    map[row.company_id].count += 1;
  }

  const result: Record<string, CompanyReviewSummary> = {};
  for (const [cid, { sum, count }] of Object.entries(map)) {
    result[cid] = { avg: Math.round((sum / count) * 10) / 10, count };
  }
  return result;
}

// ─── Role alias map (alias → role_id) ────────────────────────────────────────
export type RoleAlias = { alias: string; roleId: string };

const getRoleAliasRows = unstable_cache(
  async (): Promise<RoleAlias[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("ow_role_aliases").select("alias, role_id");
    return (data ?? []).map((r) => ({ alias: r.alias as string, roleId: r.role_id as string }));
  },
  ["role-aliases"],
  { revalidate: 3600 }
);

/**
 * 検索用の職種辞書。**職種名（ow_roles.name）と別名（ow_role_aliases.alias）の両方**を返す。
 * `roleIds` にはその語が指す職種そのものだけを入れる（祖先も子孫も入れない）。
 *
 * ── 子孫まで届く仕組み（2026-08-06 にここへ移した）────────────────────────
 * 求人側の `job.roleIds` に「紐づく職種 ＋ その祖先」が入っている（getJobs 参照）。
 * だから辞書側は職種そのものだけを持てばよく、
 *   ・「営業」で引く → 営業 が roleIds に入っている求人＝営業配下すべてに当たる
 *   ・「エンタープライズセールス」で引く → その職種の求人だけに当たる（兄弟は出ない）
 * が同じ1本の判定で成立する。
 *
 * ⚠️ 辞書側を祖先方向に広げてはいけない。2026-08-06 まではそうしており、
 *    「法人営業」→ フィールドセールス → 親の営業 まで広がって、
 *    フィールドセールスの求人が0件でも営業配下14件を返していた。
 *    「子職種で検索したのに祖先の兄弟まで出る」状態になる。
 *
 * ⚠️ 職種名そのものを辞書に入れているのが要。別名（ow_role_aliases）には
 *    大分類を指すものが1件も無く（「営業」を含む別名10件はすべて子職種行き）、
 *    別名だけを見ていた頃は「営業」で検索しても大分類に当たらなかった。
 *    ここを別名テーブルに大分類を足して解決してはいけない。
 *    別名は「その職種の別の呼び方」であって、上位概念を入れると意味が壊れる。
 */
export type SearchAlias = { alias: string; roleIds: string[] };

export const getRoleAliases = cache(async function getRoleAliases(): Promise<SearchAlias[]> {
  const [rows, tree] = await Promise.all([getRoleAliasRows(), getRoleTree()]);
  const out: SearchAlias[] = rows.map((r) => ({ alias: r.alias, roleIds: [r.roleId] }));
  for (const node of Array.from(tree.byId.values())) {
    out.push({ alias: node.name, roleIds: [node.id] });
  }
  return out;
});

// ─── Company Tools ────────────────────────────────────────────────────────────

export type CompanyTool = {
  id: string;
  tool_id: string;
  note: string | null;
  sort_order: number;
  name: string;
  category: string;
  master_sort_order: number;
};

export async function getCompanyTools(companyId: string): Promise<CompanyTool[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_company_tools")
    .select("id, tool_id, note, sort_order, ow_tool_masters!tool_id(name, category, sort_order)")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getCompanyTools]", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const master = (row as unknown as { ow_tool_masters: { name: string; category: string; sort_order: number } | null }).ow_tool_masters;
    return {
      id: row.id,
      tool_id: row.tool_id,
      note: row.note,
      sort_order: row.sort_order,
      name: master?.name ?? "",
      category: master?.category ?? "",
      master_sort_order: master?.sort_order ?? 0,
    };
  });
}

// ─── Industries (for search filter) ──────────────────────────────────────────
export type IndustryForFilter = { id: string; parent_id: string | null; name: string; slug: string };

export const getIndustriesForFilter = unstable_cache(
  async (): Promise<IndustryForFilter[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ow_industries")
      .select("id, parent_id, name, slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    return (data ?? []) as IndustryForFilter[];
  },
  ["industries-filter"],
  { revalidate: 3600 }
);
