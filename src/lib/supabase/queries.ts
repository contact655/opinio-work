/**
 * queries.ts — Supabase data access layer for Stage 1 (read-only public pages)
 *
 * Scope: ow_companies + ow_jobs only (ow_ prefix tables only)
 * Mentors: mock継続 (Stage 2 で ow_users.is_mentor で実装)
 * Articles: mock継続 (ow_articles テーブルなし)
 */

import { createClient } from "./server";
import type { Company, WorkStyle } from "@/app/companies/mockCompanies";
import type { Job } from "@/app/jobs/mockJobData";
import type {
  CompanyDetail,
  JobCat,
  JobItem,
} from "@/app/companies/[id]/mockDetailData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

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
function mapCompany(row: Record<string, any>, jobCount = 0): Company {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    tagline: (row.tagline as string) ?? "",
    industry: (row.industry as string) ?? "",
    phase: (row.phase as string) ?? "",
    employee_count: (row.employee_count as number) ?? 0,
    work_styles: deriveWorkStyles(row),
    job_count: jobCount,
    current_mentors: 0,
    alumni_mentors: 0,
    accepting_casual_meetings: (row.accepting_casual_meetings as boolean) ?? false,
    updated_days_ago: daysSince(row.updated_at as string),
    gradient: (row.logo_gradient as string) ?? FALLBACK_GRADIENT,
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
  if (row.work_style) tags.push(row.work_style as string);
  else if (row.remote_work_status) tags.push(row.remote_work_status as string);
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
    employment_type: (row.employment_type as string) ?? "正社員",
    location: (row.location as string) ?? "",
    work_style: (row.work_style as string) ?? (row.remote_work_status as string) ?? "",
    salary_min: salaryMin,
    salary_max: salaryMax,
    experience: "",
    tags,
    highlight: (row.catch_copy as string) ?? (row.one_liner as string) ?? "",
    updated_days_ago: daysSince(row.updated_at as string),
    is_new: isNew,
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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCompanyDetail(row: Record<string, any>, jobs: Record<string, any>[]): CompanyDetail {
  // jobs → JobCat[] (全求人を1カテゴリにまとめる)
  const jobCats: JobCat[] = jobs.length > 0
    ? (() => {
        // job_category ごとにグループ化
        const grouped: Record<string, typeof jobs> = {};
        for (const j of jobs) {
          const cat = (j.job_category as string) ?? "その他";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(j);
        }
        return Object.entries(grouped).map(([cat, items]) => ({
          cat,
          total: items.length,
          items: items.map((j) => {
            const sMin = j.salary_min as number;
            const sMax = j.salary_max as number;
            const salary = sMin && sMax ? `¥${sMin}–${sMax}万` : "応相談";
            const item: JobItem = {
              title: (j.title as string) ?? "",
              tags: [],
              salary,
            };
            const pub = j.published_at as string | null;
            if (pub && daysSince(pub) <= 7) item.is_new = true;
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
    opinion_date: "編集部情報",
    opinion_fit: Array.isArray(row.fit_positives) ? row.fit_positives as string[] : [],
    opinion_care: Array.isArray(row.fit_negatives) ? row.fit_negatives as string[] : [],
    freshness: [],
    work_location: [
      {
        label: (row.remote_work_status as string) ?? "オフィス勤務",
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
  updated_at: string;
  job_count: number;
};

const COMPANY_LISTPAGE_COLS = [
  "id", "name", "tagline", "industry", "phase", "employee_count",
  "logo_gradient", "logo_letter", "logo_url",
  "location", "accepting_casual_meetings", "remote_work_status",
  "is_published", "updated_at",
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

  // Fetch active job counts for all companies in one round trip
  const { data: jobRows } = await supabase
    .from("ow_jobs")
    .select("company_id")
    .eq("status", "active");

  const jobCountMap = new Map<string, number>();
  for (const j of jobRows ?? []) {
    const cid = j.company_id as string;
    jobCountMap.set(cid, (jobCountMap.get(cid) ?? 0) + 1);
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
    updated_at: (row.updated_at as string) ?? "",
    job_count: jobCountMap.get(row.id as string) ?? 0,
  }));
}

// ─── Company queries ──────────────────────────────────────────────────────────

const COMPANY_LIST_COLS = [
  "id", "name", "tagline", "industry", "phase", "employee_count",
  "logo_gradient", "logo_letter", "accepting_casual_meetings",
  "updated_at", "remote_work_status", "flex_time", "side_job_ok",
].join(", ");

const COMPANY_DETAIL_COLS = [
  ...COMPANY_LIST_COLS.split(", "),
  "mission", "description", "founded_year", "ceo_name",
  "location", "url", "fit_positives", "fit_negatives", "why_join",
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

export async function getCompanyById(
  id: string
): Promise<{ company: Company; detail: CompanyDetail } | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("ow_companies")
    .select(COMPANY_DETAIL_COLS)
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error?.code !== "PGRST116") console.error("[getCompanyById]", error?.message);
    return null;
  }

  // Fetch jobs for this company (for detail page job list)
  const { data: jobRows } = await supabase
    .from("ow_jobs")
    .select("id, title, job_category, salary_min, salary_max, published_at")
    .eq("company_id", id);

  const company = mapCompany(data, jobRows?.length ?? 0);
  const detail = buildCompanyDetail(data, jobRows ?? []);

  return { company, detail };
}

// ─── Job queries ──────────────────────────────────────────────────────────────

const JOB_LIST_COLS = [
  "id", "company_id", "title", "job_category", "employment_type",
  "location", "work_style", "salary_min", "salary_max",
  "catch_copy", "one_liner", "published_at", "updated_at", "remote_work_status",
].join(", ");

const JOB_DETAIL_COLS = [
  ...JOB_LIST_COLS.split(", "),
  "description", "requirements", "preferred_skills", "selection_process",
  "message_to_candidates", "what_youll_do_intro", "who_we_want_intro",
].join(", ");

export async function getJobs(): Promise<{ jobs: Job[]; companies: Company[] }> {
  const supabase = createClient();

  const [{ data: jobRows, error: jobErr }, { data: compRows }] = await Promise.all([
    supabase
      .from("ow_jobs")
      .select(JOB_LIST_COLS)
      .order("updated_at", { ascending: false }),
    supabase
      .from("ow_companies")
      .select(COMPANY_LIST_COLS),
  ]);

  if (jobErr) console.error("[getJobs]", jobErr.message);

  const companies = (compRows ?? []).map((row) => mapCompany(row));
  const jobs = (jobRows ?? []).map((row) => mapJob(row));

  return { jobs, companies };
}

export async function getJobById(
  id: string
): Promise<{ job: Job; company: Company } | null> {
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

  return {
    job: mapJob(jobRow),
    company: mapCompany(compData),
  };
}

// ─── Company photos ───────────────────────────────────────────────────────────

export type CompanyPhoto = {
  id: string;
  photo_url: string;
  category: string | null;
  display_order: number;
};

export async function getCompanyPhotos(companyId: string): Promise<CompanyPhoto[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_company_photos")
    .select("id, photo_url, category, display_order")
    .eq("company_id", companyId)
    .order("display_order", { ascending: true })
    .limit(6);
  if (error) {
    console.error("[getCompanyPhotos]", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: Record<string, any>): CompanyPhoto => ({
    id: row.id as string,
    photo_url: row.photo_url as string,
    category: (row.category as string) ?? null,
    display_order: (row.display_order as number) ?? 0,
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
    .select("id, name, avatar_color")
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
    };
  });
}
