/** ⚠️ DB の CHECK（ow_jobs_status_check）と必ず同じ集合にすること。
 *  ⚠️ `active` は 2026-08-11 に削除した。復活させないこと。 */
export type JobStatus = "draft" | "pending_review" | "published" | "rejected" | "private";

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
  /* ── ★2026-09-02 に追加。**入力欄と PUT は前からあったのに、この型に無く
        `jobToForm` が空文字で固定していたため、編集画面を開き直すと消えていた。**
        `salary_note` は本番の公開2件とも埋まっており、企業が1回保存すれば失われる状態だった。
     ⚠️ 求人の編集は「取得した値をそのまま PUT で送り返す」形なので、
        **SELECT・この型・mapper・`jobToForm` の4つが揃って初めて値が残る。**
        列を足すときは4つとも触ること（CLAUDE.md「経歴に列を足すときは4箇所を揃える」と同じ形）。 */
  whyHire?: string | null;
  teamComposition?: string | null;
  first90Days?: string | null;
  probationPeriod?: string | null;
  /** 勤務体系（「所定労働時間8時間、フレックスタイム制」など） */
  workHours?: string | null;
  /** 休日・休暇（「完全週休2日制、有給休暇（10日〜）」など） */
  holidays?: string | null;
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
    rejected: 0,
    private: 0,
  };
  for (const j of jobs) {
    counts[j.status] = (counts[j.status] ?? 0) + 1;
  }
  return counts;
}
