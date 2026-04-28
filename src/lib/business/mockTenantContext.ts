import type { TenantContext, TodoCounts, MonthlyStatsWithDelta, JobStatusCounts } from "./dashboard";
import type { JobPerformance } from "./dashboard";
import type { MeetingApplication } from "@/components/business/PendingMeetings";
import type { ActivityItem } from "@/components/business/ActivityList";
import type { MatchCandidate } from "@/components/business/MatchCandidates";
import type { TeamMember } from "@/components/business/TeamMembers";
import type { RecruiterProfileData } from "@/components/business/RecruiterProfile";

export const mockTenantContext: TenantContext = {
  tenantId: "mock-tenant-opinio",
  tenantName: "株式会社Opinio",
  planType: null, // 無料プラン（プランゲート UX 確認用）
  planLabel: "未設定",
  userName: "柴 尚人",
  logoGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
  logoLetter: "O",
  currentOwnId: "mock-user-id",
  currentOwnerGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
  allCompanies: [{ id: "mock-tenant-opinio", name: "株式会社Opinio", isDefault: true }],
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

export const mockPendingMeetings: MeetingApplication[] = [
  {
    id: "meet-1",
    candidateName: "田中 翔太",
    candidateInitial: "田",
    candidateGradient: "linear-gradient(135deg, #002366, #3B5FD9)",
    jobTitle: "プロダクトマネージャー（SaaS事業）",
    appliedAt: "2時間前",
    status: "pending",
  },
  {
    id: "meet-2",
    candidateName: "鈴木 あい",
    candidateInitial: "鈴",
    candidateGradient: "linear-gradient(135deg, #7C3AED, #5B21B6)",
    jobTitle: "エンタープライズ営業（大手SaaS担当）",
    appliedAt: "昨日",
    status: "company_contacted",
  },
  {
    id: "meet-3",
    candidateName: "山本 健太",
    candidateInitial: "山",
    candidateGradient: "linear-gradient(135deg, #059669, #047857)",
    jobTitle: null,
    appliedAt: "3日前",
    status: "scheduled",
  },
];

export const mockActivities: ActivityItem[] = [
  {
    id: "act-1",
    type: "application",
    body: "田中 翔太さんが「プロダクトマネージャー」に申し込みました",
    time: "2時間前",
  },
  {
    id: "act-2",
    type: "meeting_scheduled",
    body: "山本 健太さんとのカジュアル面談が確定しました（5/2 14:00）",
    time: "昨日",
  },
  {
    id: "act-3",
    type: "job_published",
    body: "「バックエンドエンジニア（Go / Kubernetes）」が公開されました",
    time: "7日前",
  },
  {
    id: "act-4",
    type: "application",
    body: "佐藤 みのりさんが「エンタープライズ営業」に申し込みました",
    time: "8日前",
  },
];

export const mockMatchCandidates: MatchCandidate[] = [
  {
    id: "cand-1",
    name: "佐藤 みのり",
    initial: "佐",
    gradient: "linear-gradient(135deg, #DB2777, #9D174D)",
    currentRole: "PdM",
    currentCompany: "株式会社スマートHR",
    matchReasons: ["SaaS経験", "BtoB", "PMF経験"],
    matchScore: 91,
  },
  {
    id: "cand-2",
    name: "加藤 大輝",
    initial: "加",
    gradient: "linear-gradient(135deg, #D97706, #92400E)",
    currentRole: "エンジニア",
    currentCompany: "株式会社LayerX",
    matchReasons: ["Go言語", "Kubernetes", "スタートアップ"],
    matchScore: 87,
  },
  {
    id: "cand-3",
    name: "中村 ゆか",
    initial: "中",
    gradient: "linear-gradient(135deg, #059669, #047857)",
    currentRole: "CSM",
    currentCompany: "Salesforce Japan",
    matchReasons: ["エンタープライズ", "SaaS", "英語"],
    matchScore: 84,
  },
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: "member-1",
    name: "柴 尚人",
    initial: "柴",
    gradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    role: "CEO / 採用責任者",
    permission: "admin",
  },
  {
    id: "member-2",
    name: "山田 花子",
    initial: "山",
    gradient: "linear-gradient(135deg, #7C3AED, #5B21B6)",
    role: "HRマネージャー",
    permission: "editor",
  },
  {
    id: "member-3",
    name: "伊藤 次郎",
    initial: "伊",
    gradient: "linear-gradient(135deg, #059669, #047857)",
    role: "エンジニアリングマネージャー",
    permission: "viewer",
  },
];

export const mockRecruiterProfile: RecruiterProfileData = {
  name: "柴 尚人",
  initial: "柴",
  gradient: "linear-gradient(135deg, var(--royal), var(--accent))",
  role: "CEO / 採用責任者",
  bio: "Opinioを通じて、IT/SaaS業界で本当に活躍できる人材と出会えることを楽しみにしています。気軽にカジュアル面談を申し込んでください。",
  isPublic: true,
};
