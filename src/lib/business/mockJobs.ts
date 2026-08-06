// "active" は旧来のステータス値（migration 113 適用後は "published" に統一される）
export type JobStatus = "draft" | "pending_review" | "published" | "active" | "rejected" | "private";

export type BizJob = {
  id: string;
  title: string;
  jobCategory: string;
  employmentType: string;
  department?: string;
  departmentId?: string;
  departmentName?: string;
  jobRoleNames?: string[];
  /** 自社での呼び方。論理削除済みなら undefined。標準職種名と併記する */
  companyRoleName?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryNote?: string;
  location?: string;
  remoteWorkStatus?: string;
  descriptionMarkdown?: string;
  messageToCandidates?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  cultureFit?: string;
  selectionSteps: string[];
  selectionDuration?: string;
  startDatePreference?: string;
  assigneeNames: string[];
  status: JobStatus;
  meetingCount: number;
  applicationCount: number;
  urgency: "open" | "hot";
  completionPercent: number;
  lastEditedAt: string;
  publishedAt?: string;
  submittedAt?: string;
  rejectionReason?: string;
  rejectionDate?: string;
  rejectionReviewer?: string;
  // 業態タグ (Migration 210)
  businessModel?: string | null;
  // セールス職専用項目 (Migration 212)
  oteMin?: number | null;
  oteMax?: number | null;
  salesSegment?: string[] | null;
  salesHunterFarmer?: string | null;
  incentiveNote?: string | null;
  // 技術スタック (Migration 245)
  techStack?: string[] | null;
};


export type JobStatusTab = {
  status: JobStatus | "all";
  label: string;
  labelJa: string;
};

export const JOB_STATUS_TABS: JobStatusTab[] = [
  { status: "all",            label: "All",         labelJa: "すべて" },
  { status: "published",      label: "Published",   labelJa: "公開中" },
  { status: "pending_review", label: "In Review",   labelJa: "審査中" },
  { status: "draft",          label: "Draft",       labelJa: "下書き" },
  { status: "rejected",       label: "Rejected",    labelJa: "差し戻し" },
  { status: "private",        label: "Private",     labelJa: "非公開" },
];

export type JobStatusCounts = Record<JobStatus | "all", number>;

export function countByStatus(jobs: BizJob[]): JobStatusCounts {
  const counts: JobStatusCounts = {
    all: jobs.length,
    draft: 0,
    pending_review: 0,
    published: 0,
    active: 0,
    rejected: 0,
    private: 0,
  };
  for (const j of jobs) {
    // "active" は "published" 相当として集計（migration 113 適用前の互換対応）
    const key = j.status === "active" ? "published" : j.status;
    counts[key] = (counts[key] ?? 0) + 1;
    if (j.status === "active") counts.active = (counts.active ?? 0) + 1;
  }
  return counts;
}
