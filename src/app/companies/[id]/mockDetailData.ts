import type { Benefit } from "@/lib/companies/benefits";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FreshnessItem = {
  date: string;
  type: "interview" | "survey" | "article" | "sns";
  label: string;
};

export type JobItem = {
  id?: string;
  slug?: string | null;
  title: string;
  tags: string[];
  salary: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  is_new?: boolean;
  urgency?: "open" | "hot";
  publishedAt?: string | null;
  // Accordion detail fields
  description?: string | null;
  requirements?: string | null;
  selectionProcess?: string | null;
  whyHire?: string | null;
  catchCopy?: string | null;
  workStyle?: string | null;
  location?: string | null;
  employmentType?: string | null;
};

export type JobCat = {
  cat: string;
  catId?: string;       // ow_roles 親カテゴリ UUID (/jobs?category= 用)
  total: number;
  items: JobItem[];
};

export type MemberRow = {
  dept: string;
  count: number;
  mentors: number;
  initials: string[];
  mentor_flags: boolean[];
};

export type InterviewCard = {
  name: string;
  role: string;
  tenure: string;
  career: string;
  catch: string;
  date: string;
  is_current: boolean;
  status_label?: string;
  photo: number; // 1–8
  ac: number;   // avatar color 1–7
  initial: string;
};

export type ArticleItem = {
  title: string;
  excerpt: string;
  type: "interview" | "feature";
  date: string;
  thumb: 1 | 2 | 3;
};

export type CompanyNumbers = {
  avgSalary: string | null;
  avgAge: number | null;
  paidLeaveRate: number | null;
  avgOvertimeHours: string | null;
  genderRatio: string | null;
  fundingTotal: string | null;
};

export type CompanyDetail = {
  id: string;
  mission: string;
  about: string;
  established: string | null;
  ceo: string | null;
  /** ⚠️ 2026-08-11: 表示先が無く、queries.ts が全社に "非公開" を入れていたので
   *  そちらは削除した。mock の型としては残すが**新しく使わないこと**。 */
  capital?: string;
  hq: string | null;
  url: string;
  company_features: string[];
  freshness: FreshnessItem[];
  jobs: JobCat[];
  current: MemberRow[];
  alumni: MemberRow[];
  interviews: InterviewCard[];
  articles: ArticleItem[];
  related: string[];
  mentor_avatars: string[];
  mentor_current: number;
  mentor_alumni: number;
  // Numbers section (Commit AA)
  numbers: CompanyNumbers;
  // Benefits section (Commit BB)
  nearestStation: string | null;
  workTimeSystem: string | null;
  workstyleDescription: string | null;
  /* ⚠️ 2026-08-31 に `string[]` から変えた。DB は jsonb。
        型は `lib/companies/benefits.ts` の `Benefit` を使う（ここで書き直さない）。 */
  benefits: Benefit[] | null;
  evaluationSystem: string | null;
  // Fit section
  fit_positives: string[] | null;
  fit_negatives: string[] | null;
  show_fit_negatives?: boolean;
  // Why join (separate from about/description)
  why_join: string | null;
  // Culture description + keywords
  culture_description?: string | null;
  culture_keywords?: string[] | null;
  // Products & Customers
  main_products?: string[] | null;
  main_customers?: string[] | null;
  /** 主な営業先。**顧客ではなく、顧客企業の中の部署**（営業部・人事部・情報システム部など）。
   *  ⚠️ `main_customers`（顧客そのもの）と混ぜないこと。粒度が違う。 */
  main_sales_targets?: string[] | null;
  customer_cases?: Array<{
    name: string;
    industry: string;
    products: string[];
    usecase: string;
    result: string;
  }> | null;
  // Reality disclosure
  reality_disclosure?: {
    notFor?: string | null;
    turnoverReasons?: string[] | null;
    onboardingGaps?: string | null;
  } | null;
  // ② ビジネスモデル
  biz_model_types?: string[] | null;
  biz_model_note?: string | null;
  // ③ 顧客・マーケット
  market_customer_size?: string[] | null;
  market_decision_maker?: string | null;
  market_note?: string | null;
  // ⑦ 資本関係・グループ
  capitalType?: string | null;
  parentCompanyName?: string | null;
  parentCompanyCountry?: string | null;
  listedExchange?: string | null;
  capitalNotes?: string | null;
  globalEmployeeCount?: string | null;
  // ⑧ 拠点・勤務地
  headquartersAddress?: string | null;
  branchLocations?: string[] | null;
  remoteWorkStatus?: string | null;
  // Numbers survey timestamp
  numbersUpdatedAt: string | null;
  // Org teams
  orgTeams: Array<{
    name: string;
    en_name: string;
    division?: string;
    mission: string;
    description: string;
    roles: string[];
  }> | null;
};

