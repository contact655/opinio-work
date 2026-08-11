import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { getCompanyContext } from "@/lib/business/company";

/**
 * Opinio Business — Dashboard data layer
 *
 * すべての fetch は try/catch で空値を返す。
 * テーブル/ビューが未存在でもダッシュボードがクラッシュしないようガードする。
 */

export const INDUSTRY_AVG_CONVERSION_RATE = 4.1; // %

// ─── Types ────────────────────────────────────────────

export type TenantCompany = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  isPublished: boolean;          // ow_companies.is_published
  isApproved: boolean;           // ow_companies.is_approved — 運営が承認済みか
  planType: "performance" | "saas_monthly" | "saas_yearly" | null;
  planLabel: string;
  userName: string;
  logoGradient: string | null;
  logoLetter: string | null;
  currentOwnId: string;          // ow_users.id (UUID) — assignee resolution
  currentOwnerGradient: string;  // avatar_color or royal fallback
  allCompanies: TenantCompany[]; // all active memberships (for CompanySwitcher)
  currentPermission: "admin" | "member"; // Phase 12: current user's permission in the active tenant
};

export type JobStatusCounts = {
  active: number;
  review: number;
  draft: number;
  closed: number;
};

export type TodoCounts = {
  reply_overdue: number;
  new_applications: number;
  interviews_today: number;
};

export type MonthlyStats = {
  applications: number;
  scouts: number;
  interviews: number;
  offers: number;
};

export type MonthlyStatsWithDelta = {
  current: MonthlyStats;
  previous: MonthlyStats;
  delta: { applications: number; scouts: number; interviews: number; offers: number };
};

export type JobPerformance = {
  job_id: string;
  title: string;
  status: string | null;
  created_at: string;
  view_count: number;
  application_count: number;
  conversion_rate_pct: number;
  isUnderperforming: boolean;
};

// ─── Helpers ──────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  performance: "成果報酬プラン",
  saas_monthly: "SaaS月額プラン",
  saas_yearly: "SaaS年額プラン",
};

/** 当月の YYYY-MM-01 を ISO 文字列で返す */
function monthStart(d = new Date()): string {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  return start.toISOString().slice(0, 10);
}
function previousMonthStart(d = new Date()): string {
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return start.toISOString().slice(0, 10);
}

const ZERO_STATS: MonthlyStats = { applications: 0, scouts: 0, interviews: 0, offers: 0 };

// ─── Tenant Context ───────────────────────────────────

/**
 * 現在ログイン中ユーザーの企業ロール (tenant_id) と企業情報を取得。
 * 企業ロールが無い場合は null を返す。
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const supabase = createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // admin client で RLS をバイパスして確実に company membership を解決する
    const admin = createAdminClient();
    const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
    const ctx = await getCompanyContext(admin, user.id, cookieCompanyId);
    if (!ctx) return null;

    // Multi-company: redirect to selection page when no cookie is set
    if (!cookieCompanyId && ctx.allMemberships.length > 1) {
      redirect("/biz/select-company");
    }

    const { companyId: tenantId, owUserId } = ctx;
    const allMembershipIds = ctx.allMemberships.map((m) => m.companyId);

    // ow_companies / ow_users / ow_tenant_plans を一括並列取得
    const [companiesRes, owUserRes, planRes] = await Promise.all([
      admin.from("ow_companies")
        .select("id, name, logo_gradient, logo_letter, is_published, is_approved")
        .in("id", allMembershipIds),
      admin.from("ow_users")
        .select("avatar_color")
        .eq("id", owUserId)
        .maybeSingle(),
      admin.from("ow_tenant_plans")
        .select("plan_type")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r, () => ({ data: null, error: null })),
    ]);

    const companies = companiesRes.data ?? [];
    const companyRow = companies.find((c) => c.id === tenantId);
    if (!companyRow) return null;

    // allCompanies: joined_at 順を保持
    const allCompanies: TenantCompany[] = ctx.allMemberships.map((m) => ({
      id: m.companyId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (companies as any[]).find((c) => c.id === m.companyId)?.name ?? "(不明)",
      isDefault: m.isDefault,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planType: TenantContext["planType"] = ((planRes as any).data?.plan_type as any) ?? null;

    const userName =
      (user.user_metadata as any)?.name ||
      (user.email ? user.email.split("@")[0] : "ご担当者");

    const owUser = owUserRes.data;
    const currentOwnerGradient =
      (owUser?.avatar_color && owUser.avatar_color.startsWith("linear-gradient"))
        ? owUser.avatar_color
        : "linear-gradient(135deg, var(--royal), var(--accent))";

    // Phase 12: derive current user's permission from allMemberships
    const currentPermission: "admin" | "member" =
      ctx.allMemberships.find((m) => m.companyId === tenantId)?.permission ?? "member";

    return {
      tenantId,
      tenantName: companyRow.name || "—",
      isPublished: (companyRow as any).is_published === true,
      isApproved: (companyRow as any).is_approved === true,
      planType,
      planLabel: planType ? PLAN_LABELS[planType] || "—" : "未設定",
      userName,
      logoGradient: companyRow.logo_gradient ?? null,
      logoLetter: companyRow.logo_letter ?? null,
      currentOwnId: owUserId,
      currentOwnerGradient,
      allCompanies,
      currentPermission,
    };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return null;
  }
}

// ─── To-Do Counts ─────────────────────────────────────

export async function getTodoCounts(tenantId: string): Promise<TodoCounts> {
  const supabase = createClient();
  try {
    const { data } = await supabase
      .from("ow_business_todo_counts")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return {
      reply_overdue: data?.reply_overdue ?? 0,
      new_applications: data?.new_applications ?? 0,
      interviews_today: data?.interviews_today ?? 0,
    };
  } catch {
    return { reply_overdue: 0, new_applications: 0, interviews_today: 0 };
  }
}

// ─── Monthly Stats ────────────────────────────────────

export async function getMonthlyStats(tenantId: string): Promise<MonthlyStatsWithDelta> {
  const supabase = createClient();
  const cur = monthStart();
  const prev = previousMonthStart();
  try {
    const { data } = await supabase
      .from("ow_business_monthly_stats")
      .select("month, applications, scouts, interviews, offers")
      .eq("tenant_id", tenantId)
      .in("month", [cur, prev]);

    const rows = (data || []) as any[];
    const current = rows.find((r) => r.month === cur) || ZERO_STATS;
    const previous = rows.find((r) => r.month === prev) || ZERO_STATS;
    return {
      current: {
        applications: current.applications ?? 0,
        scouts: current.scouts ?? 0,
        interviews: current.interviews ?? 0,
        offers: current.offers ?? 0,
      },
      previous: {
        applications: previous.applications ?? 0,
        scouts: previous.scouts ?? 0,
        interviews: previous.interviews ?? 0,
        offers: previous.offers ?? 0,
      },
      delta: {
        applications: (current.applications ?? 0) - (previous.applications ?? 0),
        scouts: (current.scouts ?? 0) - (previous.scouts ?? 0),
        interviews: (current.interviews ?? 0) - (previous.interviews ?? 0),
        offers: (current.offers ?? 0) - (previous.offers ?? 0),
      },
    };
  } catch {
    return { current: ZERO_STATS, previous: ZERO_STATS, delta: { applications: 0, scouts: 0, interviews: 0, offers: 0 } };
  }
}

// ─── Job Status Counts ────────────────────────────────

export async function getJobStatusCounts(tenantId: string): Promise<JobStatusCounts> {
  const supabase = createClient();
  try {
    const { data } = await supabase
      .from("ow_jobs")
      .select("status")
      .eq("company_id", tenantId);
    const rows = data || [];
    // DB の実際のステータス値: published / pending_review / draft / rejected / private
    return {
      active: rows.filter((r: any) => r.status === "published").length,
      review: rows.filter((r: any) => r.status === "pending_review").length,
      draft: rows.filter((r: any) => r.status === "draft").length,
      closed: rows.filter((r: any) => ["rejected", "private"].includes(r.status)).length,
    };
  } catch {
    return { active: 0, review: 0, draft: 0, closed: 0 };
  }
}

// ─── Job Performance ──────────────────────────────────

export async function getJobPerformance(tenantId: string, limit = 10): Promise<JobPerformance[]> {
  const supabase = createClient();
  try {
    const { data } = await supabase
      .from("ow_business_job_performance")
      .select("job_id, title, status, created_at, view_count, application_count, conversion_rate_pct")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data || []).map((r: any) => ({
      job_id: r.job_id,
      title: r.title,
      status: r.status,
      created_at: r.created_at,
      view_count: r.view_count ?? 0,
      application_count: r.application_count ?? 0,
      conversion_rate_pct: Number(r.conversion_rate_pct ?? 0),
      isUnderperforming:
        (r.view_count ?? 0) >= 50 && // 母数が一定以上のときだけ警告
        Number(r.conversion_rate_pct ?? 0) < INDUSTRY_AVG_CONVERSION_RATE,
    }));
  } catch {
    return [];
  }
}
