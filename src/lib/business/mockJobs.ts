export type JobStatus = "draft" | "pending_review" | "published" | "rejected" | "private";

export type BizJob = {
  id: string;
  title: string;
  jobCategory: string;
  employmentType: string;
  department?: string;
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
  completionPercent: number;
  lastEditedAt: string;
  publishedAt?: string;
  submittedAt?: string;
  rejectionReason?: string;
  rejectionDate?: string;
  rejectionReviewer?: string;
};

export const MOCK_JOBS: BizJob[] = [
  {
    id: "job-1",
    title: "マーケティングディレクター（業務委託）",
    jobCategory: "マーケティング",
    employmentType: "業務委託",
    department: "タイミーキャリアプラス事業部",
    salaryMin: 600,
    salaryMax: 1000,
    location: "東京都豊島区東池袋",
    remoteWorkStatus: "ハイブリッド（週2-3日出社）",
    requiredSkills: ["BtoCマーケティング経験5年以上", "デジタル広告運用", "SNSマーケティング"],
    preferredSkills: ["スタートアップ立ち上げ経験", "マーケティングチームのマネジメント"],
    cultureFit: "不確実性の高い環境を楽しめる方。",
    selectionSteps: ["カジュアル面談", "一次面接", "課題提出", "最終面接", "リファレンスチェック"],
    selectionDuration: "3-4週間",
    startDatePreference: "1ヶ月以内",
    assigneeNames: ["山田 太郎"],
    status: "rejected",
    meetingCount: 0,
    completionPercent: 85,
    lastEditedAt: "4/20 16:30",
    rejectionReason:
      "「求める人物像」セクションで、業務に直接関係のない属性（年齢・性別など）に関する記述が含まれています。男女雇用機会均等法に基づき修正をお願いします。詳細は編集画面でご確認ください。",
    rejectionDate: "2026年4月20日 16:42",
    rejectionReviewer: "Opinio編集部",
  },
  {
    id: "job-2",
    title: "プロダクトマネージャー（タイミーキャリアプラス）",
    jobCategory: "PdM / PM",
    employmentType: "正社員",
    department: "タイミーキャリアプラス事業部",
    salaryMin: 700,
    salaryMax: 1100,
    location: "東京都豊島区東池袋",
    remoteWorkStatus: "ハイブリッド",
    requiredSkills: ["プロダクトマネジメント経験3年以上", "SaaS・BtoBプロダクト経験"],
    preferredSkills: ["データ分析経験", "スタートアップ経験"],
    selectionSteps: ["書類選考", "カジュアル面談", "1次面接", "最終面接"],
    selectionDuration: "2-3週間",
    assigneeNames: ["山田 太郎"],
    status: "published",
    meetingCount: 12,
    completionPercent: 100,
    lastEditedAt: "3/10 09:00",
    publishedAt: "2026/3/15",
  },
  {
    id: "job-3",
    title: "エンタープライズ営業（マネージャー候補）",
    jobCategory: "営業",
    employmentType: "正社員",
    department: "エンタープライズセールス部",
    salaryMin: 800,
    salaryMax: 1400,
    location: "東京都豊島区東池袋",
    remoteWorkStatus: "ハイブリッド",
    requiredSkills: ["法人営業経験5年以上", "SaaS営業経験", "エンタープライズ顧客対応経験"],
    preferredSkills: ["マネジメント経験", "英語力"],
    selectionSteps: ["書類選考", "カジュアル面談", "1次面接", "2次面接", "最終面接"],
    selectionDuration: "3週間",
    assigneeNames: ["鈴木 花子"],
    status: "published",
    meetingCount: 8,
    completionPercent: 100,
    lastEditedAt: "2/20 11:00",
    publishedAt: "2026/2/28",
  },
  {
    id: "job-4",
    title: "バックエンドエンジニア（リード候補）",
    jobCategory: "エンジニア",
    employmentType: "正社員",
    department: "プロダクト開発本部",
    salaryMin: 750,
    salaryMax: 1300,
    location: "東京都豊島区東池袋",
    remoteWorkStatus: "フルリモート可",
    requiredSkills: ["Go / Ruby / Python いずれか5年以上", "大規模システム設計経験"],
    preferredSkills: ["AWS / GCP 経験", "チームリード経験"],
    selectionSteps: ["書類選考", "コーディングテスト", "技術面接", "最終面接"],
    selectionDuration: "3-4週間",
    assigneeNames: ["中村 一郎"],
    status: "published",
    meetingCount: 5,
    completionPercent: 100,
    lastEditedAt: "2/01 14:00",
    publishedAt: "2026/2/10",
  },
  {
    id: "job-5",
    title: "カスタマーサクセスマネージャー",
    jobCategory: "カスタマーサクセス",
    employmentType: "正社員",
    department: "CS本部",
    salaryMin: 650,
    salaryMax: 950,
    location: "東京都豊島区東池袋",
    remoteWorkStatus: "ハイブリッド",
    requiredSkills: ["SaaS CSM経験3年以上", "顧客折衝・課題解決経験"],
    preferredSkills: ["Salesforce / HubSpot 経験", "チームマネジメント経験"],
    selectionSteps: ["書類選考", "カジュアル面談", "1次面接", "最終面接"],
    selectionDuration: "2-3週間",
    startDatePreference: "応相談",
    assigneeNames: ["山田 太郎"],
    status: "pending_review",
    meetingCount: 0,
    completionPercent: 100,
    lastEditedAt: "4/22 10:00",
    submittedAt: "2026/4/22",
  },
  {
    id: "job-6",
    title: "フロントエンドエンジニア",
    jobCategory: "エンジニア",
    employmentType: "正社員",
    department: "未指定",
    requiredSkills: [],
    preferredSkills: [],
    selectionSteps: ["書類選考", "カジュアル面談", "技術面接", "最終面接"],
    assigneeNames: [],
    status: "draft",
    meetingCount: 0,
    completionPercent: 40,
    lastEditedAt: "4/22 11:18",
  },
  {
    id: "job-7",
    title: "PMM（プロダクトマーケティング）",
    jobCategory: "PdM / PM",
    employmentType: "業務委託",
    department: "マーケティング部",
    salaryMin: 500,
    salaryMax: 800,
    location: "東京都豊島区東池袋",
    remoteWorkStatus: "フルリモート可",
    requiredSkills: ["マーケティング戦略立案経験", "プロダクト理解力"],
    preferredSkills: ["SaaS業界経験", "データ分析スキル"],
    selectionSteps: ["書類選考", "カジュアル面談", "1次面接", "最終面接"],
    selectionDuration: "2週間",
    assigneeNames: ["山田 太郎"],
    status: "draft",
    meetingCount: 0,
    completionPercent: 100,
    lastEditedAt: "4/18 09:42",
  },
  {
    id: "job-8",
    title: "プロダクトデザイナー",
    jobCategory: "デザイナー",
    employmentType: "正社員",
    department: "プロダクト開発本部",
    salaryMin: 600,
    salaryMax: 900,
    location: "東京都豊島区東池袋",
    remoteWorkStatus: "フルリモート可",
    requiredSkills: ["UIデザイン経験3年以上", "Figma 熟練"],
    preferredSkills: ["SaaSプロダクトデザイン経験"],
    selectionSteps: ["ポートフォリオ審査", "デザイン課題", "面接"],
    assigneeNames: ["中村 一郎"],
    status: "private",
    meetingCount: 14,
    completionPercent: 100,
    lastEditedAt: "3/01 09:00",
    publishedAt: "2026/3/05",
  },
];

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
