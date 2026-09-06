import type { Benefit } from "@/lib/companies/benefits";
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
  tagline: string;          // 公開ページ ヒーロー直下に表示
  industry: string;
  industryId: string;       // ow_industries.id（新マスタ）
  saasCategoryId: string;   // ow_saas_categories.id（IT企業のみ）
  genres: string[];         // slug 配列。ow_company_genres と同期。空配列を許容
  phase: string;
  url: string;
  careersUrl: string;
  logoGradient: string;
  logoLetter: string;
  logoUrl: string;

  // ── About（企業説明） ──────────────────────────────────────
  descriptionMarkdown: string;
  whyJoin: string;          // 入社理由・魅力（公開ページで参照）
  companyFeatures: string[]; // 企業特徴リスト（公開ページ「特徴」セクション）
  fitPositives: string[];   // 「こんな人に向いている」ポイント
  fitNegatives: string[];   // 「注意点・向いていないかも」ポイント
  showFitNegatives: boolean;   // 「慎重に検討を」欄を公開するか

  // ── 数値データ ───────────────────────────────────────────
  employeeCount: string;
  foundedAt: string;
  avgAge: string;
  avgSalary: string;
  fundingTotal: string;
  genderRatio: string;
  evaluationSystem: string;
  /* ⚠️ 2026-08-31 に `string[]` から変えた。名前＋任意の詳細を持つ。
        型は `lib/companies/benefits.ts` に集約（ここで書き直さない）。 */
  benefitsTags: Benefit[];

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

  // ── 面談スケジュール ──────────────────────────────────
  availabilityDays: string[];    // 例: ["月","水","金"]
  availabilityTimes: string[];   // 例: ["朝（9〜12時）","夜（18〜21時）"]
  availabilityNotes: string;     // 補足コメント（任意）

  // ── リアル開示 ─────────────────────────────────────────
  realityDisclosure: {
    notFor: string;              // こんな人には向かない（フリーテキスト）
    turnoverReasons: string[];   // 退職理由カテゴリ（複数選択）
    onboardingGaps: string;      // 入社後ギャップ（フリーテキスト）
  };

  // ── モック用メタ ────────────────────────────────────────
  lastPublishedAt: string;    // "2026年4月12日 14:32"
  lastPublishedAgo: string;   // "14日前"
  hasDraftChanges: boolean;
  numbersUpdatedAt: string;   // ISO date string or "" — 数値アンケートの最終回答日時
};


// セクション定義
export const COMPANY_SECTIONS = [
  { id: "basic",     label: "基本情報",     showStatus: true },
  { id: "logo",      label: "ロゴ設定",     showStatus: true },
  { id: "about",     label: "About",        showStatus: true },
  { id: "data",      label: "数値データ",   showStatus: true },
  { id: "workstyle", label: "働き方",       showStatus: true },
{ id: "photos",    label: "オフィス写真", showStatus: true },
  { id: "settings",  label: "公開設定",     showStatus: false },
] as const;

export type CompanySectionId = typeof COMPANY_SECTIONS[number]["id"];

/* ⚠️ 業種の選択肢をここに持たない。**`ow_industries` のマスタが唯一の出どころ。**
      2026-08-14 までここに独自の8値があり、`/biz/company` の編集フォームが
      求職者側のフィルタに存在しない値を保存できてしまっていた。その後
      `industryGroups.ts` からの再輸出にしたが、2026-08-25 に業種を
      `ow_industries`（フラット20件）へ移したので**再輸出ごと落とした**
      （読む側が1つも無くなったため）。選択肢は `lib/companies/industries.ts`。 */

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
