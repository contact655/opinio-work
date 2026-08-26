import type { SupabaseClient } from "@supabase/supabase-js";
import type { BizCompany } from "./mockCompany";
import type { Json } from "@/lib/supabase/types";

export type DbCompany = {
  id: string;
  user_id: string | null;
  name: string;
  tagline: string | null;
  mission: string | null;
  why_join: string | null;
  company_features: string[] | null;
  industry: string | null;
  industry_id: string | null;
  saas_category_id: string | null;
  phase: string | null;
  business_stage: string | null;
  url: string | null;
  careers_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
  logo_url: string | null;
  description: string | null;
  employee_count: string | null;
  founded_year: number | null;
  avg_age: number | null;
  avg_salary: string | null;
  funding_total: string | null;
  female_ratio: string | null;
  evaluation_system: string | null;
  benefits: string[] | null;
  fit_positives: string[] | null;
  fit_negatives: string[] | null;
  show_fit_negatives: boolean | null;
  location: string | null;
  nearest_station: string | null;
  remote_work_status: string | null;
  work_time_system: string | null;
  avg_overtime_hours: string | null;
  paid_leave_rate: number | null;
  workstyle_description: string | null;
  is_published: boolean;
  accepting_casual_meetings: boolean;
  notification_emails: string[] | null;
  availability_days: string[] | null;
  availability_times: string[] | null;
  availability_notes: string | null;
  published_at: string | null;
  draft_data: Record<string, unknown> | null;
  updated_at: string | null;
  numbers_updated_at: string | null;
  reality_disclosure: { notFor?: string; turnoverReasons?: string[]; onboardingGaps?: string } | null;
};

const SELECT_COLUMNS = [
  "id", "user_id", "name", "tagline", "mission", "why_join", "company_features",
  "industry", "industry_id", "saas_category_id", "phase", "business_stage", "url", "careers_url",
  /* ⚠️ 【廃止】列は取らないこと（about_markdown / established_at / gender_ratio）。
        2026-08-26 に description / founded_year / female_ratio へ統合済み。 */
  "logo_gradient", "logo_letter", "logo_url", "description", "employee_count", "founded_year",
  "avg_age", "avg_salary", "funding_total", "female_ratio", "evaluation_system", "benefits", "fit_positives", "fit_negatives", "location", "nearest_station",
  "remote_work_status", "work_time_system", "avg_overtime_hours", "paid_leave_rate",
  "workstyle_description", "is_published", "accepting_casual_meetings", "notification_emails", "show_fit_negatives",
  "availability_days", "availability_times", "availability_notes",
  "published_at", "draft_data", "updated_at", "numbers_updated_at",
  "reality_disclosure",
].join(", ");

function formatPublishedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatPublishedAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

export function transformDbToForm(row: DbCompany, currentPublishedGenres: string[] = []): BizCompany {
  // genres の優先順位: draft_data.genres > 現在公開中の genres > 空配列
  const draftGenres = row.draft_data?.genres;
  const genres: string[] = Array.isArray(draftGenres) ? (draftGenres as string[]) : currentPublishedGenres;

  return {
    name: row.name ?? "",
    tagline: row.tagline ?? "",
    mission: row.mission ?? "",
    whyJoin: row.why_join ?? "",
    companyFeatures: Array.isArray(row.company_features) ? row.company_features : [],
    industry: row.industry ?? "",
    industryId: (row.industry_id as string | null) ?? "",
    saasCategoryId: (row.saas_category_id as string | null) ?? "",
    genres,
    phase: row.phase ?? row.business_stage ?? "",
    url: row.url ?? "",
    careersUrl: row.careers_url ?? "",
    logoGradient: row.logo_gradient ?? "linear-gradient(135deg, var(--royal), var(--accent))",
    logoLetter: row.logo_letter ?? (row.name ? row.name[0] : "?"),
    logoUrl: row.logo_url ?? "",
    descriptionMarkdown: row.description ?? "",
    employeeCount: row.employee_count ?? "",
    foundedAt: row.founded_year != null ? String(row.founded_year) : "",
    avgAge: row.avg_age != null ? String(row.avg_age) : "",
    avgSalary: row.avg_salary ?? "",
    fundingTotal: row.funding_total ?? "",
    genderRatio: row.female_ratio ?? "",
    evaluationSystem: row.evaluation_system ?? "",
    benefitsTags: Array.isArray(row.benefits) ? row.benefits : [],
    fitPositives: Array.isArray(row.fit_positives) ? row.fit_positives : [],
    fitNegatives: Array.isArray(row.fit_negatives) ? row.fit_negatives : [],
    showFitNegatives: row.show_fit_negatives ?? false,
    location: row.location ?? "",
    nearestStation: row.nearest_station ?? "",
    remoteWorkStatus: row.remote_work_status ?? "",
    workScheduleType: row.work_time_system ?? "",
    avgOvertimeHours: row.avg_overtime_hours ?? "",
    paidLeaveRate: row.paid_leave_rate != null ? String(row.paid_leave_rate) : "",
    workstyleNote: row.workstyle_description ?? "",
    // 写真は /biz/company/page.tsx で fetchOfficePhotosForCompany により別途取得。このフィールドは使用されない。
    photos: [],
    isPublished: row.is_published ?? false,
    /* ⚠️ ?? true は書かない。accepting_casual_meetings は NOT NULL DEFAULT true なので
          null になりえず、既定値の判断は DB 側にある。ここで true に寄せると、
          将来 nullable にしたときに「未設定」を「受け付ける」と読み替えてしまう。 */
    acceptingCasualMeetings: row.accepting_casual_meetings === true,
    notificationEmails: Array.isArray(row.notification_emails)
      ? row.notification_emails.join(", ")
      : "",
    availabilityDays: Array.isArray(row.availability_days) ? row.availability_days : [],
    availabilityTimes: Array.isArray(row.availability_times) ? row.availability_times : [],
    availabilityNotes: row.availability_notes ?? "",
    realityDisclosure: {
      notFor: row.reality_disclosure?.notFor ?? "",
      turnoverReasons: row.reality_disclosure?.turnoverReasons ?? [],
      onboardingGaps: row.reality_disclosure?.onboardingGaps ?? "",
    },
    lastPublishedAt: formatPublishedAt(row.published_at),
    lastPublishedAgo: formatPublishedAgo(row.published_at),
    hasDraftChanges: row.draft_data != null && Object.keys(row.draft_data).length > 0,
    numbersUpdatedAt: row.numbers_updated_at ?? "",
  };
}

export function transformFormToDb(form: BizCompany): { [key: string]: Json | undefined } {
  const avgAge = parseInt(form.avgAge.replace(/[^\d]/g, ""), 10);
  const paidLeave = parseInt(form.paidLeaveRate.replace(/[^\d]/g, ""), 10);
  return {
    name: form.name,
    tagline: form.tagline || null,
    mission: form.mission || null,
    why_join: form.whyJoin || null,
    company_features: form.companyFeatures.length > 0 ? form.companyFeatures : null,
    industry: form.industry || null,
    industry_id: form.industryId || null,
    saas_category_id: form.saasCategoryId || null,
    genres: form.genres ?? [],
    phase: form.phase || null,
    url: form.url || null,
    careers_url: form.careersUrl || null,
    logo_gradient: form.logoGradient || null,
    logo_letter: form.logoLetter || null,
    logo_url: form.logoUrl || null,
    /* ⚠️ **正は `description`。** 2026-08-26 に統合した。
          以前は `about_markdown` に書いていたが、求職者側は `description` を読むため
          企業が書いた企業説明は**どこにも出なかった**（本番0件）。
       ⚠️ 描画は plain text（改行で段落分け／`companies/[id]` の `detail.about`）。
          **markdown は解釈されない。** 入力欄も markdown を promote しない形にしてある。 */
    description: form.descriptionMarkdown || null,
    employee_count: form.employeeCount || null,
    /* ⚠️ **正は `founded_year`(int)。** 求職者側は年しか表示しない。
          以前は `established_at`(text) に書いており、PATCH は `founded_year` を読むため
          **公開のたびに設立年が NULL で潰れていた。** */
    founded_year: form.foundedAt ? (parseInt(form.foundedAt.replace(/[^\d]/g, "").slice(0, 4), 10) || null) : null,
    avg_age: isNaN(avgAge) ? null : avgAge,
    avg_salary: form.avgSalary || null,
    funding_total: form.fundingTotal || null,
    /* ⚠️ **正は `female_ratio`。** `gender_ratio` は本番0件のまま廃止した。 */
    female_ratio: form.genderRatio || null,
    evaluation_system: form.evaluationSystem || null,
    benefits: form.benefitsTags.length > 0 ? form.benefitsTags : null,
    fit_positives: form.fitPositives.length > 0 ? form.fitPositives : null,
    fit_negatives: form.fitNegatives.length > 0 ? form.fitNegatives : null,
    show_fit_negatives: form.showFitNegatives,
    location: form.location || null,
    nearest_station: form.nearestStation || null,
    remote_work_status: form.remoteWorkStatus || null,
    work_time_system: form.workScheduleType || null,
    avg_overtime_hours: form.avgOvertimeHours || null,
    paid_leave_rate: isNaN(paidLeave) ? null : paidLeave,
    workstyle_description: form.workstyleNote || null,
    is_published: form.isPublished,
    accepting_casual_meetings: form.acceptingCasualMeetings,
    notification_emails: form.notificationEmails
      ? form.notificationEmails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)
      : null,
    availability_days: form.availabilityDays.length > 0 ? form.availabilityDays : null,
    availability_times: form.availabilityTimes.length > 0 ? form.availabilityTimes : null,
    availability_notes: form.availabilityNotes || null,
    reality_disclosure: {
      notFor: form.realityDisclosure.notFor || null,
      turnoverReasons: form.realityDisclosure.turnoverReasons.length > 0
        ? form.realityDisclosure.turnoverReasons
        : null,
      onboardingGaps: form.realityDisclosure.onboardingGaps || null,
    },
    updated_at: new Date().toISOString(),
  };
}

import { toPlanType, type PlanType } from "@/lib/constants/plans";

// ── Multi-tenant context ─────────────────────────────────────────────────────

export type CompanyMembership = {
  companyId: string;
  isDefault: boolean;
  joinedAt: string | null;    // ISO timestamp (may be null on legacy rows)
  permission: "admin" | "member";
};

export type CompanyContext = {
  companyId: string;              // resolved current company
  owUserId: string;               // ow_users.id (NOT auth.users.id)
  allMemberships: CompanyMembership[];
  /**
   * いま有効な契約プラン。`ow_company_plans` の status='active' の行。
   *
   * ⚠️ **プランの正はこの表。`ow_companies.plan` は廃止予定で読まない。**
   * ⚠️ 取れなければ null。`canUse()` は null を「何も開かない」に倒す。
   *    ここを既定値 'free' で埋めないこと。取得失敗と無料契約が区別できなくなる。
   */
  planType: PlanType | null;
};

/**
 * Resolve the current company context for an authenticated user.
 *
 * Resolution order:
 *   1. Cookie biz_current_company_id → verify membership → use if valid
 *   2. is_default=true membership
 *   3. Oldest joined_at membership (fallback)
 *
 * Returns null when the user has no active company memberships.
 */
export async function getCompanyContext(
  supabase: SupabaseClient,
  authUserId: string,
  cookieCompanyId?: string,
): Promise<CompanyContext | null> {
  // Step 1: auth_id → ow_users.id
  // NOTE: ow_company_admins に FK 制約がないため embedded join (!inner) は使えない。
  //       2 クエリに分割して解決する。
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUserId)
    .maybeSingle();

  if (!owUser) return null;

  // Step 2: ow_users.id → ow_company_admins
  const { data: adminRows } = await supabase
    .from("ow_company_admins")
    .select("company_id, is_default, joined_at, permission")
    .eq("user_id", owUser.id)
    .eq("is_active", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = adminRows ?? [];
  if (rows.length === 0) return null;

  // joined_at で昇順ソート（DB ORDER BY の代替）
  rows.sort((a, b) => {
    if (!a.joined_at) return 1;
    if (!b.joined_at) return -1;
    return a.joined_at < b.joined_at ? -1 : 1;
  });

  const allMemberships: CompanyMembership[] = rows.map((r) => ({
    companyId: r.company_id,
    isDefault: r.is_default ?? false,
    joinedAt: r.joined_at ?? null,
    permission: r.permission as "admin" | "member",
  }));

  // 3. 解決: Cookie → is_default → oldest joined_at
  let resolved: CompanyMembership | undefined;

  if (cookieCompanyId) {
    resolved = allMemberships.find((m) => m.companyId === cookieCompanyId);
  }
  if (!resolved) {
    resolved = allMemberships.find((m) => m.isDefault);
  }
  if (!resolved) {
    resolved = allMemberships[0]; // already sorted ASC by joined_at
  }

  /* いま有効なプランを引く。
     ⚠️ **API はこの関数を直接呼ぶものが多い。** 画面（getTenantContext）だけに
        プラン判定を置くと、API を直接叩かれたときに素通りする。
        ここで解決して `canUse()` に渡せるようにしておく。 */
  const { data: planRow, error: planError } = await supabase
    .from("ow_company_plans")
    .select("plan_type")
    .eq("company_id", resolved.companyId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  /* ⚠️ error を捨てない。捨てると権限エラーもテーブル名の間違いも
        「プラン未設定」に化ける（CLAUDE.md「?? [] は 403 を 0件に化けさせる」）。 */
  if (planError) {
    console.error("[getCompanyContext] ow_company_plans:", planError.message);
  }

  return {
    companyId: resolved.companyId,
    owUserId: owUser.id,
    allMemberships,
    planType: toPlanType(planRow?.plan_type ?? null),
  };
}

export async function fetchCompanyForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  currentPublishedGenres: string[] = [],
): Promise<BizCompany | null> {
  const { data, error } = await supabase
    .from("ow_companies")
    .select(SELECT_COLUMNS)
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[company] fetchCompanyForTenant error:", error.message);
    return null;
  }
  if (!data) return null;

  return transformDbToForm(data as unknown as DbCompany, currentPublishedGenres);
}
