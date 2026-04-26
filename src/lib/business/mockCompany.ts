// BizCompany — 企業側プロダクト用の型定義とモックデータ

export type PhotoCategory = "workspace" | "meeting" | "welfare" | "event";

export type OfficePhoto = {
  id: string;
  url: string;       // 実際の画像URL (mock では空文字)
  caption: string;
  category: PhotoCategory;
  gradient: string;  // mock 用の背景グラデーション
};

export type BizCompany = {
  // ── 基本情報 ──────────────────────────────────────────────
  name: string;
  mission: string;
  industry: string;
  phase: string;
  url: string;
  logoGradient: string;
  logoLetter: string;

  // ── About（企業説明） ──────────────────────────────────────
  descriptionMarkdown: string;

  // ── 数値データ ───────────────────────────────────────────
  employeeCount: string;
  foundedAt: string;
  avgAge: string;
  genderRatio: string;
  evaluationSystem: string;
  benefitsTags: string[];

  // ── 働き方 ───────────────────────────────────────────────
  location: string;
  nearestStation: string;
  remoteWorkStatus: string;
  workScheduleType: string;
  avgOvertimeHours: string;
  paidLeaveRate: string;
  workstyleNote: string;

  // ── オフィス写真（S4b で本格対応）────────────────────────
  photos: OfficePhoto[];

  // ── 公開設定 ────────────────────────────────────────────
  isPublished: boolean;
  acceptingCasualMeetings: boolean;
  notificationEmails: string;

  // ── モック用メタ ────────────────────────────────────────
  lastPublishedAt: string;    // "2026年4月12日 14:32"
  lastPublishedAgo: string;   // "14日前"
  hasDraftChanges: boolean;
};

export const MOCK_COMPANY: BizCompany = {
  // 基本情報
  name: "株式会社タイミー",
  mission: "「はたらく」を通じて人生の可能性を広げるインフラをつくる",
  industry: "IT / SaaS",
  phase: "上場(東証グロース)",
  url: "https://timee.co.jp",
  logoGradient: "linear-gradient(135deg, #F97316, #EA580C)",
  logoLetter: "T",

  // About
  descriptionMarkdown: `## 私たちについて

タイミーは、スキマ時間にすぐ働ける仕事と、人手が足りない事業者をマッチングするサービスです。「はたらく」を通じて、人生の可能性を広げることを目指しています。

## 事業の特徴

- **スポットワークの市場創出** — 日本においてスポットワーク市場を立ち上げてきた、業界のパイオニア
- **両面のプロダクト** — ワーカー側・事業者側、両方のプロダクトを自社で開発
- **データドリブンな組織** — マッチングアルゴリズムを継続的に改善

## カルチャー

タイミーの組織は、**役割を超える文化**を大切にしています。エンジニアが営業同行することもあれば、PdMが現場のリサーチに行くこともあります。

> 「職域の壁を作らず、市場の本質に向き合う」`,

  // 数値データ
  employeeCount: "1,642",
  foundedAt: "2017年8月",
  avgAge: "29歳",
  genderRatio: "男性 65% / 女性 35%",
  evaluationSystem: "半期ごとの目標設定 + 360度評価。OKRをベースに個人と組織の目標を連動。",
  benefitsTags: ["フレックスタイム制", "リモートワーク可", "書籍購入支援", "社員食堂", "産休・育休制度"],

  // 働き方
  location: "東京都豊島区東池袋1-9-6 ヒューリック東池袋ビル 6F",
  nearestStation: "JR池袋駅 東口より徒歩3分",
  remoteWorkStatus: "ハイブリッド（週2-3日出社）",
  workScheduleType: "フレックスタイム制",
  avgOvertimeHours: "20時間",
  paidLeaveRate: "78%",
  workstyleNote: "フレックスはコアタイム10:00-15:00。週2-3日のオフィス出社は、チームでの議論や対話を大切にするため。残業は事前申請制で、無理な残業は推奨していません。",

  // 写真（S4b で本格対応）
  photos: [],

  // 公開設定
  isPublished: true,
  acceptingCasualMeetings: true,
  notificationEmails: "recruiting@timee.co.jp",

  // メタ
  lastPublishedAt: "2026年4月12日 14:32",
  lastPublishedAgo: "14日前",
  hasDraftChanges: true,
};

// セクション定義
export const COMPANY_SECTIONS = [
  { id: "basic",     label: "基本情報",     showStatus: true },
  { id: "about",     label: "About",        showStatus: true },
  { id: "data",      label: "数値データ",   showStatus: true },
  { id: "workstyle", label: "働き方",       showStatus: true },
  { id: "photos",    label: "オフィス写真", showStatus: true },
  { id: "settings",  label: "公開設定",     showStatus: false },
] as const;

export type CompanySectionId = typeof COMPANY_SECTIONS[number]["id"];

export const INDUSTRY_OPTIONS = [
  "IT / SaaS",
  "コンサルティング",
  "金融 / FinTech",
  "製造業",
  "医療 / ヘルスケア",
  "教育",
  "EC / 小売",
  "その他",
];

export const PHASE_OPTIONS = [
  "シード",
  "シリーズA",
  "シリーズB-C",
  "レイターステージ",
  "上場(東証グロース)",
  "上場(東証プライム)",
  "上場(東証スタンダード)",
  "その他",
];

export const REMOTE_OPTIONS = [
  "フルリモート可",
  "ハイブリッド（週2-3日出社）",
  "原則出社",
  "その他",
];

export const WORK_SCHEDULE_OPTIONS = [
  "固定時間制",
  "フレックスタイム制",
  "裁量労働制",
  "その他",
];
