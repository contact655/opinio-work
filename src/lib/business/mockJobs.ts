import type { LaborTerms } from "@/lib/jobs/laborTerms";
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
  /** ★報酬・給与が「要相談」（2026-10-10） */
  salaryNegotiable?: boolean;
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
  /** ★運営が停止した理由・日時（2026-10-12）。status = private と組み合わせて「停止中」 */
  stoppedReason?: string;
  stoppedAt?: string;
  /** ★求人管理の一覧用（2026-10-12）。公開に必要なのに足りない項目の数（下書きの「公開まであと〇つ」） */
  publishMissingCount?: number;
  /** ★禁止表現（「〇〇」（欄））。公開をブロックする（2026-10-12）。一覧の「公開まであと〇つ」に数える */
  wordingHits?: string[];
  /** ★閲覧数（直近30日。ow_page_view_daily） */
  views30d?: number;
  /** 一覧の「更新日」（ISO）。⚠️ lastEditedAt は「3日前」などの表示用 */
  updatedAtIso?: string;
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
  /** ★労働条件（2026-10-11）。lib/jobs/laborTerms.ts */
  laborTerms?: LaborTerms;
};


/* ★画面の状態（下書き／公開中／停止中）は lib/jobs/jobState.ts の1か所（2026-10-12）。
      ⚠️ ここにあった JOB_STATUS_TABS（運営確認中・停止中・非公開のタブ）と jobViewStatus は外した。戻さないこと */
import { jobState, jobStateTab, type JobStateTab } from "@/lib/jobs/jobState";

export type JobTabCounts = Record<JobStateTab | "all", number>;

export function countByTab(jobs: Pick<BizJob, "status" | "stoppedAt">[]): JobTabCounts {
  const counts: JobTabCounts = { all: jobs.length, published: 0, draft: 0, stopped: 0 };
  for (const j of jobs) counts[jobStateTab(jobState(j))] += 1;
  return counts;
}
