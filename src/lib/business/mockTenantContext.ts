import type { TenantContext, TodoCounts, MonthlyStatsWithDelta, JobStatusCounts } from "./dashboard";
import type { JobPerformance } from "./dashboard";

export const mockTenantContext: TenantContext = {
  tenantId: "mock-tenant-opinio",
  tenantName: "株式会社Opinio",
  planType: null, // 無料プラン（プランゲート UX 確認用）
  planLabel: "未設定",
  userName: "柴 尚人",
  logoGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
  logoLetter: "O",
};

export const mockTodoCounts: TodoCounts = {
  reply_overdue: 2,
  new_applications: 5, // urgent カードを目立たせる
  interviews_today: 1,
};

export const mockMonthlyStats: MonthlyStatsWithDelta = {
  current: {
    applications: 18,
    scouts: 0,     // 無料プランはスカウトなし
    interviews: 12,
    offers: 0,
  },
  previous: {
    applications: 14,
    scouts: 0,
    interviews: 9,
    offers: 0,
  },
  delta: {
    applications: 4,
    scouts: 0,
    interviews: 3,
    offers: 0,
  },
};

export const mockJobStatusCounts: JobStatusCounts = {
  active: 3,
  review: 1,
  draft: 2,
  closed: 0,
};

export const mockJobPerformance: JobPerformance[] = [
  {
    job_id: "mock-job-1",
    title: "プロダクトマネージャー（SaaS事業）",
    status: "active",
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 312,
    application_count: 18,
    conversion_rate_pct: 5.8,
    isUnderperforming: false,
  },
  {
    job_id: "mock-job-2",
    title: "エンタープライズ営業（大手SaaS担当）",
    status: "active",
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 204,
    application_count: 6,
    conversion_rate_pct: 2.9,
    isUnderperforming: true, // 業界平均 4.1% を下回る
  },
  {
    job_id: "mock-job-3",
    title: "バックエンドエンジニア（Go / Kubernetes）",
    status: "active",
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 89,
    application_count: 5,
    conversion_rate_pct: 5.6,
    isUnderperforming: false,
  },
  {
    job_id: "mock-job-4",
    title: "マーケティングマネージャー",
    status: "review",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 0,
    application_count: 0,
    conversion_rate_pct: 0,
    isUnderperforming: false,
  },
  {
    job_id: "mock-job-5",
    title: "カスタマーサクセス（SaaS）",
    status: "draft",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    view_count: 0,
    application_count: 0,
    conversion_rate_pct: 0,
    isUnderperforming: false,
  },
];
