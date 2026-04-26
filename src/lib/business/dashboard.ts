import { createClient } from "@/lib/supabase/server";

/**
 * Opinio Business — Dashboard data layer
 *
 * すべての fetch は try/catch で空値を返す。
 * テーブル/ビューが未存在でもダッシュボードがクラッシュしないようガードする。
 */

export const INDUSTRY_AVG_CONVERSION_RATE = 4.1; // %

// ─── Types ────────────────────────────────────────────

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  planType: "performance" | "saas_monthly" | "saas_yearly" | null;
  planLabel: string;
  userName: string;
  logoGradient: string | null;
  logoLetter: string | null;
  currentOwnId: string;          // ow_users.id (UUID) — assignee resolution
  currentOwnerGradient: string;  // avatar_color or royal fallback
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

    const { data: roleRow } = await supabase
      .from("ow_user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("role", "company")
      .not("tenant_id", "is", null)
      .maybeSingle();

    // フォールバック: ow_user_roles.tenant_id が未設定の場合（migration 028 適用前の登録ユーザー等）
    // ow_companies.user_id = auth.uid() で直接検索する
    let tenantId: string | null = roleRow?.tenant_id ?? null;
    let companyRow: { name: string; logo_gradient: string | null; logo_letter: string | null; logo_url: string | null } | null = null;

    if (tenantId) {
      const { data } = await supabase
        .from("ow_companies")
        .select("name, logo_gradient, logo_letter, logo_url")
        .eq("id", tenantId)
        .maybeSingle();
      companyRow = data;
    } else {
      // フォールバック: ow_companies.user_id で検索
      const { data } = await supabase
        .from("ow_companies")
        .select("id, name, logo_gradient, logo_letter, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        tenantId = (data as any).id;
        companyRow = data;
      }
    }

    if (!tenantId) return null;

    let planType: TenantContext["planType"] = null;
    try {
      const { data: planRow } = await supabase
        .from("ow_tenant_plans")
        .select("plan_type")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      planType = (planRow?.plan_type as any) ?? null;
    } catch {
      // ow_tenant_plans が無い場合に備える
    }

    // 表示名: メアドの@より前 or fallback
    const userName =
      (user.user_metadata as any)?.name ||
      (user.email ? user.email.split("@")[0] : "ご担当者");

    // ow_users.id と avatar_color を取得（assignee 機能で使用）
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id, avatar_color")
      .eq("auth_id", user.id)
      .maybeSingle();

    const currentOwnId = owUser?.id ?? "";
    const currentOwnerGradient =
      (owUser?.avatar_color && owUser.avatar_color.startsWith("linear-gradient"))
        ? owUser.avatar_color
        : "linear-gradient(135deg, var(--royal), var(--accent))";

    return {
      tenantId: tenantId,
      tenantName: companyRow?.name || "—",
      planType,
      planLabel: planType ? PLAN_LABELS[planType] || "—" : "未設定",
      userName,
      logoGradient: (companyRow as any)?.logo_gradient ?? null,
      logoLetter: (companyRow as any)?.logo_letter ?? null,
      currentOwnId,
      currentOwnerGradient,
    };
  } catch {
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
