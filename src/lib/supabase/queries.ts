/**
 * queries.ts — Supabase data access layer for Stage 1 (read-only public pages)
 *
 * Scope: ow_companies + ow_jobs only (ow_ prefix tables only)
 * Mentors: mock継続 (Stage 2 で ow_users.is_mentor で実装)
 * Articles: mock継続 (ow_articles テーブルなし)
 */

import { unstable_cache } from "next/cache";
import { createClient } from "./server";
import { createPublicClient } from "./public";
import type { Company, CompanyGenre, WorkStyle } from "@/app/companies/mockCompanies";
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

function deriveWorkStyles(row: {
  remote_work_status?: string | null;
  flex_time?: boolean | null;
  side_job_ok?: boolean | null;
}): WorkStyle[] {
  const styles: WorkStyle[] = [];
  const remote = (row.remote_work_status ?? "").toLowerCase();
  if (remote.includes("フルリモート") || remote.includes("full_remote") || remote.includes("リモート可")) {
    styles.push("フルリモート");
  } else if (remote.includes("ハイブリッド") || remote.includes("hybrid")) {
    styles.push("ハイブリッド");
  }
  if (row.flex_time) styles.push("フレックス");
  if (row.side_job_ok) styles.push("副業OK");
  return styles.length > 0 ? styles : ["ハイブリッド"];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCompany(row: Record<string, any>, jobCount = 0, genres: CompanyGenre[] = []): Company {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    name_en: (row.name_en as string | null) ?? null,
    tagline: (row.tagline as string) ?? "",
    industry: (row.industry as string) ?? "",
    phase: (row.phase as string) ?? "",
    employee_count: (row.employee_count as number) ?? 0,
    work_styles: deriveWorkStyles(row),
    job_count: jobCount,
    current_mentors: 0,
    alumni_mentors: 0,
    accepting_casual_meetings: (row.accepting_casual_meetings as boolean) ?? false,
    // jobs_public が null（Migration未適用）は accepting_casual_meetings で代替
    jobs_public: row.jobs_public != null
      ? (row.jobs_public as boolean)
      : (row.accepting_casual_meetings as boolean) ?? false,
    updated_days_ago: daysSince(row.updated_at as string),
    gradient: (row.logo_gradient as string) ?? FALLBACK_GRADIENT,
    logo_url: (row.logo_url as string | null) ?? null,
    logo_letter: (row.logo_letter as string | null) ?? null,
    x_url: (row.x_url as string | null) ?? null,
    linkedin_url: (row.linkedin_url as string | null) ?? null,
    careers_url: (row.careers_url as string | null) ?? null,
    genres,
    is_editors_pick: false,
    is_dimmed: false,
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
    ? reqRaw.split(/\n|・|、/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  const prefRaw = row.preferred_skills ?? row.preferred;
  const preferredSkills: string[] = Array.isArray(prefRaw)
    ? prefRaw
    : typeof prefRaw === "string" && prefRaw.trim()
    ? prefRaw.split(/\n|・|、/).map((s: string) => s.trim()).filter(Boolean)
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
    company_id: row.company_id as string,
    role: (row.title as string) ?? "",
    dept: (row.job_category as string) ?? "",
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
    established: row.founded_year ? `${row.founded_year}年` : "—",
    ceo: (row.ceo_name as string) ?? "—",
    capital: "非公開",
    hq: (row.location as string) ?? "東京都",
    url: (row.url as string) ?? "",
    company_features: Array.isArray(row.company_features) ? row.company_features as string[] : [],
    freshness: [],
    work_location: [
      {
        label: (() => { const raw = row.remote_work_status as string | null; return raw ? (WORK_STYLE_LABELS[raw] ?? raw) : "オフィス勤務"; })(),
        note: "求人ページで詳細確認",
      },
    ],
    work_style: [
      { label: row.flex_time ? "フレックス制度" : "固定時間制", note: "" },
      { label: row.side_job_ok ? "副業可（申請制）" : "副業不可", note: "" },
    ],
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
  name: string;
  tagline: string;
  industry: string;
  phase: string;
  employee_count: number;
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
};

const COMPANY_LISTPAGE_COLS = [
  "id", "name", "tagline", "industry", "phase", "employee_count",
  "logo_gradient", "logo_letter", "logo_url",
  "location", "accepting_casual_meetings", "remote_work_status",
  "is_published", "jobs_public", "updated_at",
].join(", ");

/**
 * Companies list for the /companies jobseeker page.
 * dev環境ではis_publishedフィルターを無効化（テストデータが少ないため全15件表示）。
 * 本番環境では is_published=true の企業のみ表示。
 */
export async function getCompaniesForList(): Promise<CompanyListRow[]> {
  const supabase = createClient();

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

  // Fetch active job counts + first office photo per company in parallel
  const [{ data: jobRows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("ow_jobs")
      .select("company_id")
      .in("status", ["active", "published"]),
    supabase
      .from("ow_company_office_photos")
      .select("company_id, image_url, display_order")
      .order("display_order", { ascending: true }),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (companyRows ?? []).map((row: Record<string, any>): CompanyListRow => ({
    id: row.id as string,
    name: (row.name as string) ?? "",
    tagline: (row.tagline as string) ?? "",
    industry: (row.industry as string) ?? "",
    phase: (row.phase as string) ?? "",
    employee_count: (row.employee_count as number) ?? 0,
    location: (row.location as string) ?? "",
    logo_gradient: (row.logo_gradient as string) ?? null,
    logo_letter: (row.logo_letter as string) ?? null,
    logo_url: (row.logo_url as string) ?? null,
    accepting_casual_meetings: (row.accepting_casual_meetings as boolean) ?? false,
    remote_work_status: (row.remote_work_status as string) ?? null,
    is_published: (row.is_published as boolean) ?? false,
    // jobs_public: null の場合（Migrationが未適用の開発環境など）は accepting_casual_meetings で代替
    jobs_public: row.jobs_public != null
      ? (row.jobs_public as boolean)
      : (row.accepting_casual_meetings as boolean) ?? false,
    updated_at: (row.updated_at as string) ?? "",
    job_count: jobCountMap.get(row.id as string) ?? 0,
    cover_photo_url: coverPhotoMap.get(row.id as string) ?? null,
  }));
}

// ─── Company queries ──────────────────────────────────────────────────────────

const COMPANY_LIST_COLS = [
  "id", "name", "name_en", "tagline", "industry", "phase", "employee_count",
  "logo_gradient", "logo_letter", "logo_url", "accepting_casual_meetings",
  "updated_at", "remote_work_status", "flex_time", "side_job_ok",
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

export async function getCompanyById(
  id: string
): Promise<{ company: Company; detail: CompanyDetail; employeeCategories: CompanyEmployeeCategoryItem[] } | null> {
  const supabase = createClient();

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
      .select("id, title, job_category, role_category_id, salary_min, salary_max, published_at, urgency, description, requirements, selection_process, why_hire, catch_copy, work_style, employment_type, location")
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
}

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

// ─── Job queries ──────────────────────────────────────────────────────────────

const JOB_LIST_COLS = [
  "id", "company_id", "title", "job_category", "role_category_id", "employment_type",
  "location", "work_style", "salary_min", "salary_max",
  "catch_copy", "one_liner", "published_at", "updated_at", "remote_work_status", "urgency",
].join(", ");

const JOB_DETAIL_COLS = [
  ...JOB_LIST_COLS.split(", "),
  "description", "requirements", "preferred_skills", "selection_process",
  "message_to_candidates", "what_youll_do_intro", "who_we_want_intro",
  "why_hire", "team_composition", "first_90_days",
].join(", ");

export const getJobs = unstable_cache(
  async (): Promise<{ jobs: Job[]; companies: Company[] }> => {
    const supabase = createPublicClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jobQuery: any = supabase
      .from("ow_jobs")
      .select(JOB_LIST_COLS)
      .order("updated_at", { ascending: false });
    if (process.env.NODE_ENV !== "development") {
      jobQuery = jobQuery.in("status", ["active", "published"]);
    }

    const [{ data: jobRows, error: jobErr }, { data: compRows }] = await Promise.all([
      jobQuery,
      supabase.from("ow_companies").select(COMPANY_LIST_COLS),
    ]);

    if (jobErr) console.error("[getJobs]", jobErr.message);

    const companies = (compRows ?? []).map((row) => mapCompany(row));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs = (jobRows ?? []).map((row: Record<string, any>) => mapJob(row));

    return { jobs, companies };
  },
  ["jobs-list"],
  { revalidate: 300 }
);

export async function getJobById(
  id: string
): Promise<{ job: Job; company: Company; relatedJobs: Job[] } | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("ow_jobs")
    .select(JOB_DETAIL_COLS)
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error?.code !== "PGRST116") console.error("[getJobById]", error?.message);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobRow = data as Record<string, any>;

  const { data: compData, error: compErr } = await supabase
    .from("ow_companies")
    .select(COMPANY_LIST_COLS)
    .eq("id", jobRow.company_id)
    .single();

  if (compErr || !compData) {
    console.error("[getJobById] company not found for", jobRow.company_id);
    return null;
  }

  // Fetch up to 3 other jobs from same company
  const { data: relatedRows } = await supabase
    .from("ow_jobs")
    .select("id, title, job_category, role_category_id, salary_min, salary_max, published_at, updated_at")
    .eq("company_id", jobRow.company_id)
    .in("status", ["active", "published"])
    .neq("id", jobRow.id)
    .limit(3);
  const relatedJobs: Job[] = (relatedRows ?? []).map((r) => mapJob(r as Record<string, unknown>));

  return {
    job: mapJob(jobRow),
    company: mapCompany(compData),
    relatedJobs,
  };
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
  const supabase = createClient();
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
      .in("id", taggedUserIds);
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
  const supabase = createClient();

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
    .in("id", userIds);

  const userMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userRows ?? []).map((u: Record<string, any>) => [u.id as string, u])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return adminRows.map((row: Record<string, any>): CompanyRecruiter => {
    const user = userMap.get(row.user_id as string);
    const name = (user?.name as string) ?? "担当者";
    return {
      id: row.id as string,
      name,
      avatar_initial: name.charAt(0),
      avatar_color: (user?.avatar_color as string) ?? null,
      department: (row.department as string) ?? null,
      role_title: (row.role_title as string) ?? null,
      catchphrase: (user?.catchphrase as string) ?? null,
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
  // === Session 9: 一言コメント ===
  catchphrase: string | null;
};

export async function getCompanyEmployees(companyId: string): Promise<{
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
}> {
  const supabase = createClient();
  const EMPTY = { current: [], alumni: [] };

  // 全 ow_roles を取得 (カテゴリ名・親情報解決用)
  const { data: allRoles } = await supabase
    .from("ow_roles")
    .select("id, name, parent_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleMap = new Map<string, Record<string, any>>(
    (allRoles ?? []).map((r) => [r.id as string, r])
  );

  // 現役社員 (is_current = true)
  const { data: currentRows, error: e1 } = await supabase
    .from("ow_experiences")
    .select("role_title, role_category_id, ow_users!inner(id, name, avatar_color, avatar_url, can_casual_meeting, catchphrase)")
    .eq("company_id", companyId)
    .eq("is_current", true);

  if (e1) {
    console.error("[getCompanyEmployees current]", e1.message);
    return EMPTY;
  }

  // OB 社員 (is_current = false, ended_at あり)
  const { data: alumniRows, error: e2 } = await supabase
    .from("ow_experiences")
    .select("role_title, role_category_id, started_at, ended_at, ow_users!inner(id, name, avatar_color, avatar_url, can_casual_meeting, catchphrase)")
    .eq("company_id", companyId)
    .eq("is_current", false)
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false });

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
      roleTitle: (row.role_title as string | null) ?? null,
      startedAt: startedAt ? (startedAt as string).slice(0, 7) : null,
      endedAt: endedAt ? (endedAt as string).slice(0, 7) : null,
      roleCategoryId,
      roleCategoryName: (role?.name as string | null) ?? null,
      roleParentId: (role?.parent_id as string | null) ?? null,
      roleParentName: (parent?.name as string | null) ?? null,
      canCasualMeeting: (u?.can_casual_meeting as boolean) ?? false,
      currentRoleTitle: null,   // 退職後キャリア: 後で補完
      currentCompanyName: null, // 退職後キャリア: 後で補完
      catchphrase: (u?.catchphrase as string | null) ?? null,
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

  const currentEmps = dedupeByUser((currentRows ?? []).map((r) => mapEmp(r)));
  const alumniEmps  = dedupeByUser((alumniRows ?? []).map((r) => mapEmp(r, r.ended_at, r.started_at)));

  // OB/OG の「退職後の現在キャリア」を取得（is_current=true の経験から）
  if (alumniEmps.length > 0) {
    const alumniUserIds = alumniEmps.map((e) => e.userId);
    const { data: currentExpRows } = await supabase
      .from("ow_experiences")
      .select("user_id, role_title, company_text, ow_companies(name)")
      .in("user_id", alumniUserIds)
      .eq("is_current", true);

    if (currentExpRows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextMap = new Map<string, { roleTitle: string | null; companyName: string | null }>();
      for (const row of currentExpRows) {
        const uid = row.user_id as string;
        if (!nextMap.has(uid)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const co = row.ow_companies as Record<string, any> | null;
          nextMap.set(uid, {
            roleTitle: (row.role_title as string | null) ?? null,
            companyName: (co?.name as string | null) ?? (row.company_text as string | null) ?? null,
          });
        }
      }
      for (const emp of alumniEmps) {
        const next = nextMap.get(emp.userId);
        if (next) {
          emp.currentRoleTitle = next.roleTitle;
          emp.currentCompanyName = next.companyName;
        }
      }
    }
  }

  return { current: currentEmps, alumni: alumniEmps };
}

// ─── Company employee categories (ow_company_employee_categories) ─────────────

/** Phase Q: 各企業のカテゴリ表示設定 (display_order 順) */
export type CompanyEmployeeCategoryItem = {
  id: string;
  roleId: string;
  roleName: string;
  parentId: string | null;
  parentName: string | null;
  displayOrder: number;
};

export async function getCompanyEmployeeCategories(
  companyId: string
): Promise<CompanyEmployeeCategoryItem[]> {
  const supabase = createClient();

  const [catResult, rolesResult] = await Promise.all([
    supabase
      .from("ow_company_employee_categories")
      .select("id, role_id, display_order, ow_roles!inner(id, name, parent_id)")
      .eq("company_id", companyId)
      .order("display_order"),
    supabase
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = item.ow_roles as Record<string, any>;
    const parent = role.parent_id ? roleMap.get(role.parent_id as string) : null;
    return {
      id: item.id as string,
      roleId: role.id as string,
      roleName: role.name as string,
      parentId: (role.parent_id as string | null) ?? null,
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

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_articles")
    .select(ARTICLE_DETAIL_COLS)
    .eq("slug", slug)
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
}

export async function getArticlesByCompany(companyId: string): Promise<Article[]> {
  const supabase = createClient();

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
