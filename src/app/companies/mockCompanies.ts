export type WorkStyle =
  | "フルリモート" | "副業OK" | "フレックス" | "週4日勤務" | "時短勤務" | "裁量労働" | "ハイブリッド";

export type Company = {
  id: string;
  name: string;
  tagline: string;
  industry: string;
  phase: string;
  employee_count: number;
  work_styles: WorkStyle[];
  job_count: number;
  current_mentors: number;
  alumni_mentors: number;
  accepting_casual_meetings: boolean;
  updated_days_ago: number;
  gradient: string;
  is_editors_pick?: boolean;
  is_dimmed?: boolean; // 非公開・休止中
};

export const MOCK_COMPANIES: Company[] = [
  {
    id: "layerx",
    name: "LayerX",
    tagline: "あらゆる産業の合理化をテクノロジーで実現する",
    industry: "FinTech",
    phase: "Series C",
    employee_count: 450,
    work_styles: ["フルリモート", "副業OK", "フレックス"],
    job_count: 12,
    current_mentors: 3,
    alumni_mentors: 5,
    accepting_casual_meetings: true,
    updated_days_ago: 1,
    gradient: "linear-gradient(135deg, #002366, #3B5FD9)",
    is_editors_pick: true,
  },
  {
    id: "smarthr",
    name: "SmartHR",
    tagline: "労務・人事・タレントマネジメントをひとつに",
    industry: "HR Tech",
    phase: "Series E",
    employee_count: 980,
    work_styles: ["フルリモート", "副業OK", "時短勤務"],
    job_count: 24,
    current_mentors: 5,
    alumni_mentors: 8,
    accepting_casual_meetings: true,
    updated_days_ago: 4,
    gradient: "linear-gradient(135deg, #059669, #047857)",
    is_editors_pick: false,
  },
  {
    id: "hubspot-japan",
    name: "HubSpot Japan",
    tagline: "中小企業のインバウンドマーケティングを世界へ",
    industry: "SaaS / 外資",
    phase: "上場 (NYSE)",
    employee_count: 120,
    work_styles: ["フルリモート", "副業OK", "フレックス"],
    job_count: 8,
    current_mentors: 2,
    alumni_mentors: 4,
    accepting_casual_meetings: true,
    updated_days_ago: 3,
    gradient: "linear-gradient(135deg, #F97316, #EA580C)",
    is_editors_pick: false,
  },
  {
    id: "salesforce-japan",
    name: "Salesforce Japan",
    tagline: "世界No.1 CRMで企業のデジタルトランスフォーメーションを加速",
    industry: "SaaS / 外資",
    phase: "上場 (NYSE)",
    employee_count: 3000,
    work_styles: ["ハイブリッド", "副業OK", "フレックス"],
    job_count: 31,
    current_mentors: 8,
    alumni_mentors: 14,
    accepting_casual_meetings: true,
    updated_days_ago: 20,
    gradient: "linear-gradient(135deg, #22D3EE, #0891B2)",
    is_editors_pick: false,
  },
  {
    id: "ubie",
    name: "Ubie",
    tagline: "テクノロジーで人々を適切な医療に案内する",
    industry: "HealthTech",
    phase: "Series D",
    employee_count: 380,
    work_styles: ["フルリモート", "副業OK", "週4日勤務"],
    job_count: 16,
    current_mentors: 4,
    alumni_mentors: 0,
    accepting_casual_meetings: true,
    updated_days_ago: 7,
    gradient: "linear-gradient(135deg, #DB2777, #BE185D)",
    is_editors_pick: false,
  },
  {
    id: "freee",
    name: "freee",
    tagline: "スモールビジネスのバックオフィスをまるごと自動化",
    industry: "FinTech",
    phase: "東証グロース",
    employee_count: 1200,
    work_styles: ["フルリモート", "副業OK", "時短勤務"],
    job_count: 19,
    current_mentors: 6,
    alumni_mentors: 9,
    accepting_casual_meetings: true,
    updated_days_ago: 10,
    gradient: "linear-gradient(135deg, #4F46E5, #3730A3)",
    is_editors_pick: false,
  },
  {
    id: "sansan",
    name: "Sansan",
    tagline: "名刺・契約・請求書データで企業の働き方を変革する",
    industry: "SaaS",
    phase: "東証プライム",
    employee_count: 1600,
    work_styles: ["ハイブリッド", "フレックス", "副業OK"],
    job_count: 27,
    current_mentors: 3,
    alumni_mentors: 7,
    accepting_casual_meetings: true,
    updated_days_ago: 18,
    gradient: "linear-gradient(135deg, #DC2626, #B91C1C)",
    is_editors_pick: false,
  },
  {
    id: "money-forward",
    name: "マネーフォワード",
    tagline: "お金をポジティブな力に変えるFinTechインフラ",
    industry: "FinTech",
    phase: "東証プライム",
    employee_count: 2100,
    work_styles: ["ハイブリッド", "副業OK", "フレックス"],
    job_count: 34,
    current_mentors: 7,
    alumni_mentors: 11,
    accepting_casual_meetings: false,
    updated_days_ago: 14,
    gradient: "linear-gradient(135deg, #475569, #1E293B)",
    is_editors_pick: false,
  },
  {
    id: "pksha-technology",
    name: "PKSHA Technology",
    tagline: "AIアルゴリズムで人間とソフトウェアの共進化を実現",
    industry: "AI / LLM",
    phase: "東証グロース",
    employee_count: 320,
    work_styles: ["ハイブリッド", "裁量労働"],
    job_count: 0,
    current_mentors: 2,
    alumni_mentors: 3,
    accepting_casual_meetings: false,
    updated_days_ago: 32,
    gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)",
    is_dimmed: true,
  },
  {
    id: "datadog-japan",
    name: "Datadog Japan",
    tagline: "クラウドインフラの可観測性をエンタープライズへ",
    industry: "SaaS / 外資",
    phase: "上場 (NASDAQ)",
    employee_count: 200,
    work_styles: ["フルリモート", "副業OK", "フレックス"],
    job_count: 9,
    current_mentors: 3,
    alumni_mentors: 6,
    accepting_casual_meetings: true,
    updated_days_ago: 5,
    gradient: "linear-gradient(135deg, #A78BFA, #7C3AED)",
    is_editors_pick: false,
  },
  {
    id: "kubell",
    name: "kubell",
    tagline: "ビジネスコミュニケーションをChatworkで再定義する",
    industry: "SaaS",
    phase: "東証グロース",
    employee_count: 520,
    work_styles: ["フルリモート", "フレックス", "副業OK"],
    job_count: 14,
    current_mentors: 2,
    alumni_mentors: 4,
    accepting_casual_meetings: true,
    updated_days_ago: 8,
    gradient: "linear-gradient(135deg, #0EA5E9, #0284C7)",
    is_editors_pick: false,
  },
  {
    id: "notion-japan",
    name: "Notion Japan",
    tagline: "思考・ドキュメント・プロジェクト管理をひとつのワークスペースに",
    industry: "SaaS / 外資",
    phase: "Series C",
    employee_count: 85,
    work_styles: ["フルリモート", "副業OK", "フレックス"],
    job_count: 5,
    current_mentors: 1,
    alumni_mentors: 2,
    accepting_casual_meetings: true,
    updated_days_ago: 2,
    gradient: "linear-gradient(135deg, #1E293B, #0F172A)",
    is_editors_pick: false,
  },
];

// ─── Filter helpers ───────────────────────────────────────────────────────────

export const INDUSTRIES = Array.from(new Set(MOCK_COMPANIES.map((c) => c.industry))).sort();

export const PHASES = Array.from(new Set(MOCK_COMPANIES.map((c) => c.phase)));

export const EMPLOYEE_RANGES = [
  { label: "50名以下",   min: 0,    max: 50 },
  { label: "51〜200名",  min: 51,   max: 200 },
  { label: "201〜500名", min: 201,  max: 500 },
  { label: "501〜1000名",min: 501,  max: 1000 },
  { label: "1001名以上", min: 1001, max: Infinity },
];

export type FilterParams = {
  industry?: string;
  phase?: string;
  employees?: string;
  meeting?: string;
  sort?: string;
};

export function filterCompanies(companies: Company[], params: FilterParams): Company[] {
  let result = [...companies];

  if (params.industry) {
    result = result.filter((c) => c.industry === params.industry);
  }
  if (params.phase) {
    result = result.filter((c) => c.phase === params.phase);
  }
  if (params.employees) {
    const range = EMPLOYEE_RANGES.find((r) => r.label === params.employees);
    if (range) {
      result = result.filter((c) => c.employee_count >= range.min && c.employee_count <= range.max);
    }
  }
  if (params.meeting === "1") {
    result = result.filter((c) => c.accepting_casual_meetings);
  }

  // Sort
  if (params.sort === "employees") {
    result.sort((a, b) => b.employee_count - a.employee_count);
  } else {
    // Default: updated (newest first)
    result.sort((a, b) => a.updated_days_ago - b.updated_days_ago);
  }

  return result;
}

export function formatUpdated(days: number): string {
  if (days === 0) return "今日更新";
  if (days === 1) return "昨日更新";
  if (days <= 7) return `${days}日前更新`;
  if (days <= 14) return "今週更新";
  if (days <= 21) return "先週更新";
  if (days <= 31) return "今月更新";
  return `${Math.floor(days / 7)}週間前更新`;
}
