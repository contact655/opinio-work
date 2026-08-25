// DB CHECK constraint (migration 031):
// pending / company_contacted / scheduled / completed / declined
// "scheduling" was removed — merged into "scheduled" (Commit Y).

export type MeetingStatus =
  | "pending"
  | "company_contacted"
  | "scheduled"
  | "completed"
  | "declined";

export type CareerEntry = {
  period: string;
  role: string;
  company: string;
  isCurrent: boolean;
};

export type MeetingApplication = {
  id: string;
  // 申込者
  applicantUserId: string | null; // ow_users.id — 公開プロフィールリンク用
  applicantName: string;
  applicantInitial: string;
  applicantGradient: string;
  applicantAge: string;
  applicantCurrentCompany: string;
  applicantCurrentRole: string;
  // 申込内容
  jobTitle: string | null;
  jobSalary: string | null;
  intent: string;
  intentDetail: string;
  interestReason: string;
  questions: string;
  preferredFormat: string;
  // メタ
  submittedAt: string;
  status: MeetingStatus;
  isUnread: boolean;
  // 企業側
  assigneeId: string | null;
  assigneeName: string | null;
  /** ★求職者が指名した「話を聞きたい人」の名前（2026-08-25）。指名が無ければ null。
   *  ⚠️ `assigneeName`（実際に対応する人）とは**別物**。企業が誰を割り当てても消えない。 */
  requestedName?: string | null;
  assigneeInitial: string | null;
  assigneeGradient: string | null;
  companyMemo: string;
  // キャリア
  career: CareerEntry[];
};


export const STATUS_TABS = [
  { status: "pending" as MeetingStatus, label: "新規受信", shortLabel: "新規" },
  { status: "company_contacted" as MeetingStatus, label: "確認中", shortLabel: "確認中" },
  { status: "scheduled" as MeetingStatus, label: "面談予定", shortLabel: "予定" },
  { status: "completed" as MeetingStatus, label: "完了", shortLabel: "完了" },
  { status: "declined" as MeetingStatus, label: "見送り", shortLabel: "見送り" },
] as const;
