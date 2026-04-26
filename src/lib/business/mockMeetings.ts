// TODO: scheduling status is mock-only.
// Add Supabase migration when wiring to ow_casual_meetings status check constraint.

export type MeetingStatus =
  | "pending"
  | "company_contacted"
  | "scheduling"
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
  assigneeInitial: string | null;
  assigneeGradient: string | null;
  companyMemo: string;
  // キャリア
  career: CareerEntry[];
};

export const MOCK_MEETINGS: MeetingApplication[] = [
  // ── pending (新規受信) ── 4件、うち先頭4件を未読
  {
    id: "meet-p1",
    applicantName: "田中 翔太",
    applicantInitial: "田",
    applicantGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    applicantAge: "30代前半",
    applicantCurrentCompany: "株式会社タイミー",
    applicantCurrentRole: "エンタープライズ営業（現職）",
    jobTitle: "プロダクトマネージャー（SaaS事業）",
    jobSalary: "¥700-1,100万",
    intent: "良い機会があれば検討",
    intentDetail: "積極的ではないが、良い出会いがあれば前向きに",
    interestReason: "Opinioの記事でタイミーのクロス事業文化を読み、SaaSドメインでのPdM経験をどう活かせるか気になり申し込みました。",
    questions: "社内の雰囲気と実際の働き方\nこのポジションで活躍している人の特徴\n今後の事業拡張の方向性\nPdMスキルを営業でどう活かすか",
    preferredFormat: "Zoom",
    submittedAt: "3h前",
    status: "pending",
    isUnread: true,
    assigneeId: null,
    assigneeName: null,
    assigneeInitial: null,
    assigneeGradient: null,
    companyMemo: "",
    career: [
      { period: "2024.04 — 現在", role: "エンタープライズ営業", company: "株式会社タイミー", isCurrent: true },
      { period: "2022.04 — 2024.03", role: "プロダクトマネージャー", company: "株式会社タイミー", isCurrent: false },
      { period: "2018.04 — 2022.03", role: "法人営業", company: "株式会社リクルート", isCurrent: false },
    ],
  },
  {
    id: "meet-p2",
    applicantName: "佐藤 花子",
    applicantInitial: "佐",
    applicantGradient: "linear-gradient(135deg, #FBBF24, #D97706)",
    applicantAge: "20代後半",
    applicantCurrentCompany: "株式会社freee",
    applicantCurrentRole: "バックエンドエンジニア（現職）",
    jobTitle: "バックエンドエンジニア（Go / Kubernetes）",
    jobSalary: "¥600-900万",
    intent: "積極的に転職検討中",
    intentDetail: "6ヶ月以内での転職を検討しています",
    interestReason: "Go/Kubernetesの求人に興味を持ちました。現職でもGoを使っており、より規模の大きい環境で挑戦したいです。",
    questions: "チームの技術スタック詳細\nオンボーディング期間と体制\nリモートワークの実態",
    preferredFormat: "Google Meet",
    submittedAt: "昨日",
    status: "pending",
    isUnread: true,
    assigneeId: null,
    assigneeName: null,
    assigneeInitial: null,
    assigneeGradient: null,
    companyMemo: "",
    career: [
      { period: "2022.04 — 現在", role: "バックエンドエンジニア", company: "株式会社freee", isCurrent: true },
      { period: "2020.04 — 2022.03", role: "Webエンジニア", company: "株式会社サイバーエージェント", isCurrent: false },
    ],
  },
  {
    id: "meet-p3",
    applicantName: "鈴木 一郎",
    applicantInitial: "鈴",
    applicantGradient: "linear-gradient(135deg, #34D399, var(--success))",
    applicantAge: "30代後半",
    applicantCurrentCompany: "Salesforce Japan",
    applicantCurrentRole: "エンタープライズAE（現職）",
    jobTitle: null,
    jobSalary: null,
    intent: "情報収集中",
    intentDetail: "今すぐ転職は考えていないが、将来的な選択肢として情報収集したい",
    interestReason: "SaaS特化のOpinioを通じて、企業の実態を知りたいと思い申し込みました。",
    questions: "SaaS営業のキャリアパス\n御社の営業組織文化",
    preferredFormat: "どちらでも",
    submittedAt: "2日前",
    status: "pending",
    isUnread: true,
    assigneeId: null,
    assigneeName: null,
    assigneeInitial: null,
    assigneeGradient: null,
    companyMemo: "",
    career: [
      { period: "2019.07 — 現在", role: "エンタープライズAE", company: "Salesforce Japan", isCurrent: true },
      { period: "2015.04 — 2019.06", role: "法人営業", company: "株式会社野村総合研究所", isCurrent: false },
    ],
  },
  {
    id: "meet-p4",
    applicantName: "高橋 健太",
    applicantInitial: "高",
    applicantGradient: "linear-gradient(135deg, #A78BFA, var(--purple))",
    applicantAge: "30代前半",
    applicantCurrentCompany: "株式会社メルカリ",
    applicantCurrentRole: "エンジニアリングマネージャー（現職）",
    jobTitle: "プロダクトマネージャー（SaaS事業）",
    jobSalary: "¥700-1,100万",
    intent: "良い機会があれば検討",
    intentDetail: "EM経験を活かしてPdMに転向したいと考えています",
    interestReason: "EMからPdMへのキャリアチェンジに関心があり、SaaS領域での可能性を探っています。",
    questions: "EMからPdMへの転向事例\nプロダクト開発の意思決定プロセス",
    preferredFormat: "Zoom",
    submittedAt: "3日前",
    status: "pending",
    isUnread: true,
    assigneeId: null,
    assigneeName: null,
    assigneeInitial: null,
    assigneeGradient: null,
    companyMemo: "",
    career: [
      { period: "2021.04 — 現在", role: "エンジニアリングマネージャー", company: "株式会社メルカリ", isCurrent: true },
      { period: "2018.04 — 2021.03", role: "シニアエンジニア", company: "株式会社DeNA", isCurrent: false },
    ],
  },
  // ── company_contacted (確認中) ── 2件
  {
    id: "meet-c1",
    applicantName: "伊藤 美咲",
    applicantInitial: "伊",
    applicantGradient: "linear-gradient(135deg, #DB2777, #9D174D)",
    applicantAge: "20代後半",
    applicantCurrentCompany: "株式会社SmartHR",
    applicantCurrentRole: "カスタマーサクセス（現職）",
    jobTitle: "カスタマーサクセス（SaaS）",
    jobSalary: "¥500-750万",
    intent: "積極的に転職検討中",
    intentDetail: "3ヶ月以内での転職を希望しています",
    interestReason: "CSのキャリアをさらに深めたいと思い、御社の取り組みに興味を持ちました。",
    questions: "CSチームの規模と役割分担\n成果評価の基準",
    preferredFormat: "Zoom",
    submittedAt: "4日前",
    status: "company_contacted",
    isUnread: false,
    assigneeId: "member-1",
    assigneeName: "柴 尚人",
    assigneeInitial: "柴",
    assigneeGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    companyMemo: "SmartHRでのCS経験が豊富。早めに返信する。",
    career: [
      { period: "2022.01 — 現在", role: "カスタマーサクセス", company: "株式会社SmartHR", isCurrent: true },
      { period: "2020.04 — 2021.12", role: "サポートエンジニア", company: "株式会社Sansan", isCurrent: false },
    ],
  },
  {
    id: "meet-c2",
    applicantName: "渡辺 大介",
    applicantInitial: "渡",
    applicantGradient: "linear-gradient(135deg, #059669, #047857)",
    applicantAge: "30代前半",
    applicantCurrentCompany: "HubSpot Japan",
    applicantCurrentRole: "マーケティングスペシャリスト（現職）",
    jobTitle: "マーケティングマネージャー",
    jobSalary: null,
    intent: "良い機会があれば検討",
    intentDetail: "より裁量の大きい環境でのマーケティング経験を積みたい",
    interestReason: "HubSpotでのインバウンドマーケ経験を御社で活かしたいと思いました。",
    questions: "マーケティング予算の規模\n施策の意思決定プロセス",
    preferredFormat: "Google Meet",
    submittedAt: "5日前",
    status: "company_contacted",
    isUnread: false,
    assigneeId: "member-1",
    assigneeName: "柴 尚人",
    assigneeInitial: "柴",
    assigneeGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    companyMemo: "",
    career: [
      { period: "2021.06 — 現在", role: "マーケティングスペシャリスト", company: "HubSpot Japan", isCurrent: true },
      { period: "2019.04 — 2021.05", role: "デジタルマーケター", company: "株式会社電通デジタル", isCurrent: false },
    ],
  },
  // ── scheduling (日程調整中) ── 3件
  {
    id: "meet-s1",
    applicantName: "中村 ゆか",
    applicantInitial: "中",
    applicantGradient: "linear-gradient(135deg, #7C3AED, #5B21B6)",
    applicantAge: "30代前半",
    applicantCurrentCompany: "株式会社LayerX",
    applicantCurrentRole: "プロダクトマネージャー（現職）",
    jobTitle: "プロダクトマネージャー（SaaS事業）",
    jobSalary: "¥700-1,100万",
    intent: "積極的に転職検討中",
    intentDetail: "新たな事業フェーズでの挑戦を求めています",
    interestReason: "LayerXでのPdM経験を活かして、より0→1に近い環境で働きたいと思っています。",
    questions: "プロダクトのフェーズと課題\nチームカルチャー",
    preferredFormat: "Zoom",
    submittedAt: "6日前",
    status: "scheduling",
    isUnread: false,
    assigneeId: "member-1",
    assigneeName: "柴 尚人",
    assigneeInitial: "柴",
    assigneeGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    companyMemo: "5/5 15:00 or 5/7 11:00 で候補日を提案済み。返答待ち。",
    career: [
      { period: "2023.01 — 現在", role: "プロダクトマネージャー", company: "株式会社LayerX", isCurrent: true },
      { period: "2020.04 — 2022.12", role: "プロダクトマネージャー", company: "株式会社freee", isCurrent: false },
      { period: "2018.04 — 2020.03", role: "ビジネスアナリスト", company: "アクセンチュア株式会社", isCurrent: false },
    ],
  },
  {
    id: "meet-s2",
    applicantName: "加藤 大輝",
    applicantInitial: "加",
    applicantGradient: "linear-gradient(135deg, #D97706, #92400E)",
    applicantAge: "20代後半",
    applicantCurrentCompany: "株式会社Sansan",
    applicantCurrentRole: "Goエンジニア（現職）",
    jobTitle: "バックエンドエンジニア（Go / Kubernetes）",
    jobSalary: "¥600-900万",
    intent: "積極的に転職検討中",
    intentDetail: "6ヶ月以内での転職を検討",
    interestReason: "Go/Kubernetesを中心としたスタックに強い関心があります。",
    questions: "マイクロサービスの構成\nデプロイ頻度とCI/CD環境",
    preferredFormat: "Zoom",
    submittedAt: "7日前",
    status: "scheduling",
    isUnread: false,
    assigneeId: "member-1",
    assigneeName: "柴 尚人",
    assigneeInitial: "柴",
    assigneeGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    companyMemo: "",
    career: [
      { period: "2022.04 — 現在", role: "Goエンジニア", company: "株式会社Sansan", isCurrent: true },
      { period: "2020.04 — 2022.03", role: "バックエンドエンジニア", company: "株式会社ミクシィ", isCurrent: false },
    ],
  },
  {
    id: "meet-s3",
    applicantName: "山田 春香",
    applicantInitial: "山",
    applicantGradient: "linear-gradient(135deg, #F472B6, #DB2777)",
    applicantAge: "30代前半",
    applicantCurrentCompany: "Datadog Japan",
    applicantCurrentRole: "エンタープライズAE（現職）",
    jobTitle: null,
    jobSalary: null,
    intent: "良い機会があれば検討",
    intentDetail: "グローバル企業から国内SaaSへのキャリアシフトを検討中",
    interestReason: "国内SaaS領域での営業経験を積みたいと思っています。",
    questions: "営業プロセスの特徴\n顧客ターゲットの詳細",
    preferredFormat: "Google Meet",
    submittedAt: "8日前",
    status: "scheduling",
    isUnread: false,
    assigneeId: "member-2",
    assigneeName: "山田 花子",
    assigneeInitial: "山",
    assigneeGradient: "linear-gradient(135deg, #7C3AED, #5B21B6)",
    companyMemo: "エンタープライズAE経験あり。HR担当が対応予定。",
    career: [
      { period: "2020.04 — 現在", role: "エンタープライズAE", company: "Datadog Japan", isCurrent: true },
      { period: "2017.04 — 2020.03", role: "法人営業", company: "株式会社日立製作所", isCurrent: false },
    ],
  },
  // ── scheduled (面談予定) ── 1件
  {
    id: "meet-sc1",
    applicantName: "小林 誠",
    applicantInitial: "小",
    applicantGradient: "linear-gradient(135deg, #0EA5E9, #0369A1)",
    applicantAge: "30代後半",
    applicantCurrentCompany: "株式会社MoneyForward",
    applicantCurrentRole: "プロダクトオーナー（現職）",
    jobTitle: "プロダクトマネージャー（SaaS事業）",
    jobSalary: "¥700-1,100万",
    intent: "積極的に転職検討中",
    intentDetail: "3ヶ月以内での転職を希望",
    interestReason: "フィンテック領域でのPO経験を汎用SaaSに広げたいと思っています。",
    questions: "プロダクトビジョンと直近の優先課題\nPdMとエンジニアの協業スタイル",
    preferredFormat: "Zoom",
    submittedAt: "10日前",
    status: "scheduled",
    isUnread: false,
    assigneeId: "member-1",
    assigneeName: "柴 尚人",
    assigneeInitial: "柴",
    assigneeGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    companyMemo: "5/8 14:00 Zoom 確定。準備として: プロダクトロードマップ資料を共有予定。",
    career: [
      { period: "2020.01 — 現在", role: "プロダクトオーナー", company: "株式会社MoneyForward", isCurrent: true },
      { period: "2017.04 — 2019.12", role: "プロダクトマネージャー", company: "株式会社Appier", isCurrent: false },
      { period: "2014.04 — 2017.03", role: "ソフトウェアエンジニア", company: "富士通株式会社", isCurrent: false },
    ],
  },
  // ── completed (完了) ── 2件（代表的に）
  {
    id: "meet-done1",
    applicantName: "松本 理沙",
    applicantInitial: "松",
    applicantGradient: "linear-gradient(135deg, #94A3B8, #64748B)",
    applicantAge: "20代後半",
    applicantCurrentCompany: "株式会社PKSHA",
    applicantCurrentRole: "データサイエンティスト（現職）",
    jobTitle: null,
    jobSalary: null,
    intent: "情報収集中",
    intentDetail: "AI/ML領域からSaaSプロダクト側へのキャリア探索中",
    interestReason: "AIを活用したプロダクト開発に興味があります。",
    questions: "データチームの規模と役割",
    preferredFormat: "Zoom",
    submittedAt: "15日前",
    status: "completed",
    isUnread: false,
    assigneeId: "member-1",
    assigneeName: "柴 尚人",
    assigneeInitial: "柴",
    assigneeGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    companyMemo: "面談完了。技術力高い。ポジションが合えばオファーを検討。",
    career: [
      { period: "2022.04 — 現在", role: "データサイエンティスト", company: "株式会社PKSHA", isCurrent: true },
      { period: "2020.04 — 2022.03", role: "機械学習エンジニア", company: "株式会社NTTデータ", isCurrent: false },
    ],
  },
  // ── declined (見送り) ── 1件
  {
    id: "meet-d1",
    applicantName: "木村 健",
    applicantInitial: "木",
    applicantGradient: "linear-gradient(135deg, #FCA5A5, #EF4444)",
    applicantAge: "40代前半",
    applicantCurrentCompany: "大手SIer",
    applicantCurrentRole: "プロジェクトマネージャー（現職）",
    jobTitle: "プロダクトマネージャー（SaaS事業）",
    jobSalary: "¥700-1,100万",
    intent: "積極的に転職検討中",
    intentDetail: "SIerからSaaS企業への転向を検討",
    interestReason: "SIerからのキャリアチェンジを模索しています。",
    questions: "SIer出身者の受け入れ実績",
    preferredFormat: "Zoom",
    submittedAt: "20日前",
    status: "declined",
    isUnread: false,
    assigneeId: "member-1",
    assigneeName: "柴 尚人",
    assigneeInitial: "柴",
    assigneeGradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    companyMemo: "スキルセットが現在の求人と合わず。次の採用フェーズで再検討。",
    career: [
      { period: "2010.04 — 現在", role: "プロジェクトマネージャー", company: "大手SIer", isCurrent: true },
    ],
  },
];

export const STATUS_TABS = [
  { status: "pending" as MeetingStatus, label: "新規受信", shortLabel: "新規" },
  { status: "company_contacted" as MeetingStatus, label: "確認中", shortLabel: "確認中" },
  { status: "scheduling" as MeetingStatus, label: "日程調整中", shortLabel: "調整中" },
  { status: "scheduled" as MeetingStatus, label: "面談予定", shortLabel: "予定" },
  { status: "completed" as MeetingStatus, label: "完了", shortLabel: "完了" },
  { status: "declined" as MeetingStatus, label: "見送り", shortLabel: "見送り" },
] as const;
