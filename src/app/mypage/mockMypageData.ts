// ─── Status types (4c / 4d data model pre-adoption) ──────────────────────────

export type CasualMeetingStatus =
  | "pending"           // 企業確認中
  | "company_contacted" // 連絡済み
  | "scheduled"         // 日程調整中
  | "completed"         // 面談完了
  | "declined";         // 見送り

export type MentorReservationStatus =
  | "pending_review"    // 編集部確認中
  | "approved"          // 承認済み
  | "scheduled"         // 日程確定
  | "completed"         // 相談完了
  | "cancelled";        // キャンセル

export type ReceivedRequestStatus =
  | "pending"           // 未対応
  | "approved"          // 承認済み
  | "completed";        // 完了

export type BookmarkType = "article" | "company" | "job" | "mentor";

// ─── Status pill config ───────────────────────────────────────────────────────

export const STATUS_LABEL: Record<string, string> = {
  pending: "企業確認中",
  company_contacted: "連絡済み",
  scheduled: "日程調整中",
  completed: "面談完了",
  declined: "見送り",
  pending_review: "編集部確認中",
  approved: "承認済み",
  cancelled: "キャンセル",
  // mentor received
  pending_received: "未対応",
  completed_received: "完了",
};

export type PillVariant = "amber" | "royal" | "purple" | "gray" | "error" | "success";

export const STATUS_VARIANT: Record<string, PillVariant> = {
  pending: "amber",
  company_contacted: "royal",
  scheduled: "purple",
  completed: "gray",
  declined: "error",
  pending_review: "royal",
  approved: "success",
  cancelled: "gray",
  pending_received: "amber",
  completed_received: "gray",
};

export const PILL_STYLES: Record<PillVariant, { bg: string; color: string }> = {
  amber:   { bg: "var(--warm-soft)",    color: "#B45309" },
  royal:   { bg: "var(--royal-50)",     color: "var(--royal)" },
  purple:  { bg: "var(--purple-soft)",  color: "var(--purple)" },
  gray:    { bg: "var(--line-soft)",    color: "var(--ink-soft)" },
  error:   { bg: "var(--error-soft)",   color: "var(--error)" },
  success: { bg: "var(--success-soft)", color: "var(--success)" },
};

// ─── Data types ───────────────────────────────────────────────────────────────

export type CasualMeeting = {
  id: string;
  company_id: string;
  company_name: string;
  company_initial: string;
  company_gradient: string;
  job_title: string;
  applied_at: string;
  scheduled_at?: string;
  status: CasualMeetingStatus;
};

export type MentorReservation = {
  id: string;
  mentor_name: string;
  mentor_initial: string;
  mentor_gradient: string;
  mentor_role: string;
  themes: string[];
  applied_at: string;
  scheduled_at?: string;
  status: MentorReservationStatus;
};

export type Bookmark = {
  id: string;
  type: BookmarkType;
  title: string;
  meta: string;
  badge_label: string;
  href: string;
};

export type ReceivedRequest = {
  id: string;
  requester_name: string;
  requester_initial: string;
  requester_gradient: string;
  requester_role: string;
  requester_company: string;
  requester_age: string;
  themes: string[];
  preview_text: string;
  status: ReceivedRequestStatus;
  resolved_at?: string;
};

// ─── Mock user ────────────────────────────────────────────────────────────────

export const MOCK_USER = {
  name: "田中 翔太",
  initial: "田",
  avatarGradient: "linear-gradient(135deg, #002366, #3B5FD9)",
  coverGradient: "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)",
  currentRole: "株式会社LayerX · プロダクトマネージャー（Bakuraku事業）",
  profileCompletion: 65,
  isMentor: false, // toggled in UI
};

// ─── Mock casual meetings ────────────────────────────────────────────────────

export const MOCK_CASUAL_MEETINGS: CasualMeeting[] = [
  {
    id: "cm-1",
    company_id: "layerx",
    company_name: "株式会社LayerX",
    company_initial: "L",
    company_gradient: "linear-gradient(135deg, #1E40AF, #002366)",
    job_title: "Bakuraku事業 プロダクトマネージャー",
    applied_at: "2026.04.18",
    status: "pending",
  },
  {
    id: "cm-2",
    company_id: "smarthr",
    company_name: "SmartHR株式会社",
    company_initial: "S",
    company_gradient: "linear-gradient(135deg, #00B4D8, #0077B6)",
    job_title: "プロダクト企画",
    applied_at: "2026.04.12",
    scheduled_at: "2026.04.28(火) 14:00〜",
    status: "scheduled",
  },
  {
    id: "cm-3",
    company_id: "smarthr",
    company_name: "SmartHR株式会社",
    company_initial: "S",
    company_gradient: "linear-gradient(135deg, #00B4D8, #0077B6)",
    job_title: "カスタマーサクセス",
    applied_at: "2026.03.28",
    scheduled_at: "2026.04.10(水) 10:00実施済",
    status: "completed",
  },
  {
    id: "cm-4",
    company_id: "freee",
    company_name: "freee株式会社",
    company_initial: "F",
    company_gradient: "linear-gradient(135deg, #1E3A8A, #1E40AF)",
    job_title: "エンタープライズ営業",
    applied_at: "2026.03.15",
    status: "declined",
  },
];

// ─── Mock mentor reservations ─────────────────────────────────────────────────

export const MOCK_MENTOR_RESERVATIONS: MentorReservation[] = [
  {
    id: "mr-1",
    mentor_name: "渡辺 美穂",
    mentor_initial: "渡",
    mentor_gradient: "linear-gradient(135deg, #A78BFA, #7C3AED)",
    mentor_role: "AIスタートアップA社 CPO",
    themes: ["PdM → CPOへの進化", "プロダクト組織の作り方"],
    applied_at: "2026.04.16",
    status: "pending_review",
  },
  {
    id: "mr-2",
    mentor_name: "鈴木 由紀",
    mentor_initial: "鈴",
    mentor_gradient: "linear-gradient(135deg, #6366F1, #818CF8)",
    mentor_role: "外資コンサル出身PdM",
    themes: ["プロダクト思考の鍛え方", "外資系キャリアの現実"],
    applied_at: "2026.03.22",
    scheduled_at: "2026.04.05(金) 19:00実施済",
    status: "completed",
  },
  {
    id: "mr-3",
    mentor_name: "林 健太",
    mentor_initial: "林",
    mentor_gradient: "linear-gradient(135deg, #0891B2, #0E7490)",
    mentor_role: "SmartHR プロダクト企画",
    themes: ["SmartHRでの働き方", "HR Techの市場観"],
    applied_at: "2026.02.28",
    scheduled_at: "2026.03.15(土) 20:00実施済",
    status: "completed",
  },
];

// ─── Mock bookmarks ───────────────────────────────────────────────────────────

export const MOCK_BOOKMARKS_ARTICLES: Bookmark[] = [
  {
    id: "bk-a1",
    type: "article",
    badge_label: "社員インタビュー",
    title: "プロダクトを軸に営業まで広げる、職域を超える挑戦",
    meta: "田中翔太さん · タイミー · 2025.10.12",
    href: "/articles/smarthr-hayashi-csm-career",
  },
  {
    id: "bk-a2",
    type: "article",
    badge_label: "CEO・経営陣",
    title: "HR Techが変える「人事」の概念——SmartHR 芹澤CEOが描く10年後",
    meta: "芹澤雅人さん · SmartHR · 2026.03.20",
    href: "/articles/smarthr-ceo-hr-tech-future",
  },
  {
    id: "bk-a3",
    type: "article",
    badge_label: "取材レポート",
    title: "HubSpotのプロダクト組織が「顧客中心」を貫ける理由",
    meta: "2026.02.05",
    href: "/articles/hubspot-product-org-report",
  },
  {
    id: "bk-a4",
    type: "article",
    badge_label: "メンターの声",
    title: "PdM→CPOへ。渡辺美穂が語るプロダクトリーダーシップの本質",
    meta: "渡辺美穂さん · AIスタートアップA社 · 2026.01.08",
    href: "/articles/layerx-nakamura-why-mentor",
  },
  {
    id: "bk-a5",
    type: "article",
    badge_label: "社員インタビュー",
    title: "LayerX バックエンドエンジニアが語る、スタートアップの技術判断",
    meta: "鈴木拓也さん · LayerX · 2025.11.30",
    href: "/articles/layerx-suzuki-backend-career",
  },
];

export const MOCK_BOOKMARKS_COMPANIES: Bookmark[] = [
  {
    id: "bk-c1",
    type: "company",
    badge_label: "IT/SaaS",
    title: "株式会社LayerX",
    meta: "SaaS / 450名 · 募集中32件",
    href: "/companies/layerx",
  },
  {
    id: "bk-c2",
    type: "company",
    badge_label: "HR SaaS",
    title: "SmartHR株式会社",
    meta: "HR SaaS / 900名 · 募集中48件",
    href: "/companies/smarthr",
  },
  {
    id: "bk-c3",
    type: "company",
    badge_label: "FinTech",
    title: "株式会社マネーフォワード",
    meta: "FinTech / 2,100名 · 募集中73件",
    href: "/companies/moneyforward",
  },
  {
    id: "bk-c4",
    type: "company",
    badge_label: "IT/SaaS",
    title: "株式会社Ubie",
    meta: "HealthTech / 730名 · 募集中21件",
    href: "/companies/ubie",
  },
];

export const MOCK_BOOKMARKS_MENTORS: Bookmark[] = [
  {
    id: "bk-m1",
    type: "mentor",
    badge_label: "メンター",
    title: "鈴木 由紀さん",
    meta: "外資コンサル → 事業会社PdM",
    href: "/mentors",
  },
  {
    id: "bk-m2",
    type: "mentor",
    badge_label: "メンター",
    title: "渡辺 美穂さん",
    meta: "PdM → CPO / タイミー OBOG",
    href: "/mentors",
  },
  {
    id: "bk-m3",
    type: "mentor",
    badge_label: "メンター",
    title: "山本 健一さん",
    meta: "SIer → 事業会社エンジニア",
    href: "/mentors",
  },
];

// ─── Mock received requests (mentor side) ────────────────────────────────────

export const MOCK_RECEIVED_REQUESTS: ReceivedRequest[] = [
  {
    id: "rr-1",
    requester_name: "山田 美咲",
    requester_initial: "山",
    requester_gradient: "linear-gradient(135deg, #A78BFA, #7C3AED)",
    requester_role: "プロダクトマネージャー",
    requester_company: "株式会社マネーフォワード",
    requester_age: "30代前半",
    themes: ["PdM → CPOへの進化", "プロダクト組織の作り方"],
    preview_text:
      "現在、PdMからマネジメントへの役割シフトを進めています。田中さんが実際にどのような流れでマネジメントに移行されたのか、また現場での判断基準など...",
    status: "pending",
  },
  {
    id: "rr-2",
    requester_name: "高橋 翔",
    requester_initial: "高",
    requester_gradient: "linear-gradient(135deg, #FBBF24, #D97706)",
    requester_role: "プロダクトマネージャー",
    requester_company: "株式会社タイミー",
    requester_age: "20代後半",
    themes: ["タイミー出身者からの視点", "スタートアップでの経営"],
    preview_text:
      "タイミーで働いていますが、そろそろ自分で何か始めたいと考えています。田中さんがタイミーから次のキャリアを選んだ経緯や、社内での学びの活かし方を...",
    status: "pending",
  },
  {
    id: "rr-3",
    requester_name: "田中 翔太",
    requester_initial: "田",
    requester_gradient: "linear-gradient(135deg, #002366, #3B5FD9)",
    requester_role: "エンタープライズ営業",
    requester_company: "株式会社タイミー",
    requester_age: "30代前半",
    themes: ["PdM→CPOへの進化", "プロダクト組織の作り方"],
    preview_text: "2026.04.05 相談実施",
    status: "completed",
    resolved_at: "2026.04.05",
  },
  {
    id: "rr-4",
    requester_name: "佐藤 優子",
    requester_initial: "佐",
    requester_gradient: "linear-gradient(135deg, #34D399, #059669)",
    requester_role: "PdM",
    requester_company: "株式会社LayerX",
    requester_age: "30代前半",
    themes: ["AI/LLMプロダクト開発", "エンジニア出身PdM"],
    preview_text: "2026.03.22 相談実施",
    status: "completed",
    resolved_at: "2026.03.22",
  },
];
