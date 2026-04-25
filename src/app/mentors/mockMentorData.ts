/**
 * mockMentorData.ts — Single source of truth for all Opinio mentor profiles.
 *
 * Cross-references (gradient / initial / name must match exactly):
 *   mockJobData.ts     → Job["position_members"][n] where is_mentor = true
 *   mockDetailData.ts  → CompanyDetail["current"][n] / ["alumni"][n] where is_mentor = true
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CareerStep = {
  label: string;
  is_current: boolean;
};

export type CompanyLogo = {
  initial: string;
  gradient: string;
  name: string;
};

export type Mentor = {
  id: string;
  initial: string;
  gradient: string;
  name: string;
  /** 現職会社名（"非公開" で匿名表示） */
  current_company: string;
  current_role: string;
  career_chain: CareerStep[];
  company_logos: CompanyLogo[];
  themes: string[];
  /** フィルター用 */
  dept: string;
  industry: string;
  /** 整合性リファレンス */
  related_job_ids: string[];
  related_company_ids: string[];
};

// ─── Gradient palette (shared across mockJobData / mockDetailData) ────────────

const G = {
  royal:  "linear-gradient(135deg, #002366, #3B5FD9)",
  green:  "linear-gradient(135deg, #34D399, #059669)",
  pink:   "linear-gradient(135deg, #F472B6, #DB2777)",
  amber:  "linear-gradient(135deg, #FBBF24, #D97706)",
  purple: "linear-gradient(135deg, #A78BFA, #7C3AED)",
  sky:    "linear-gradient(135deg, #0EA5E9, #0369A1)",
  orange: "linear-gradient(135deg, #FB923C, #EA580C)",
  teal:   "linear-gradient(135deg, #4ADE80, #16A34A)",
  indigo: "linear-gradient(135deg, #818CF8, #4F46E5)",
  rose:   "linear-gradient(135deg, #FB7185, #E11D48)",
};

/** Company logo gradients */
const CG = {
  layerx:    "linear-gradient(135deg, #002366, #3B5FD9)",
  smarthr:   "linear-gradient(135deg, #059669, #047857)",
  hubspot:   "linear-gradient(135deg, #F97316, #EA580C)",
  salesforce:"linear-gradient(135deg, #22D3EE, #0891B2)",
  ubie:      "linear-gradient(135deg, #DB2777, #BE185D)",
  freee:     "linear-gradient(135deg, #4F46E5, #3730A3)",
  sansan:    "linear-gradient(135deg, #DC2626, #B91C1C)",
  mf:        "linear-gradient(135deg, #475569, #1E293B)",
  datadog:   "linear-gradient(135deg, #A78BFA, #7C3AED)",
  kubell:    "linear-gradient(135deg, #0EA5E9, #0284C7)",
  notion:    "linear-gradient(135deg, #1E293B, #0F172A)",
  pksha:     "linear-gradient(135deg, #7C3AED, #6D28D9)",
  google:    "linear-gradient(135deg, #4285F4, #34A853)",
  recruit:   "linear-gradient(135deg, #EF4444, #B91C1C)",
  mercari:   "linear-gradient(135deg, #F43F5E, #BE123C)",
  consult:   "linear-gradient(135deg, #64748B, #334155)",
};

// ─── Mock mentor data ─────────────────────────────────────────────────────────

export const MOCK_MENTORS: Mentor[] = [
  // ── Cross-ref: layerx-pdm-bakuraku / LayerX detail ────────────────────────
  {
    id: "nakamura-yuki",
    initial: "中",
    gradient: G.purple,
    name: "中村 由紀",
    current_company: "LayerX",
    current_role: "プロダクトマネージャー",
    career_chain: [
      { label: "メルカリ PdM", is_current: false },
      { label: "LayerX PdM（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "M", gradient: CG.mercari, name: "メルカリ" },
      { initial: "L", gradient: CG.layerx, name: "LayerX" },
    ],
    themes: ["PdMキャリア設計", "大手→スタートアップ転職", "LayerX在籍経験"],
    dept: "PdM / PM",
    industry: "FinTech",
    related_job_ids: ["layerx-pdm-bakuraku"],
    related_company_ids: ["layerx"],
  },

  // ── Cross-ref: layerx-pdm-bakuraku ────────────────────────────────────────
  {
    id: "watanabe-miho",
    initial: "渡",
    gradient: G.sky,
    name: "渡辺 美穂",
    current_company: "AIスタートアップ（非公開）",
    current_role: "CPO",
    career_chain: [
      { label: "Web系スタートアップ PdM", is_current: false },
      { label: "LayerX PdM", is_current: false },
      { label: "AIスタートアップ CPO（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "L", gradient: CG.layerx, name: "LayerX" },
    ],
    themes: ["スタートアップ経営 / CxO", "PdMキャリア設計", "マネジメント・組織作り", "LayerX在籍経験"],
    dept: "PdM / PM",
    industry: "FinTech",
    related_job_ids: ["layerx-pdm-bakuraku"],
    related_company_ids: ["layerx"],
  },

  // ── Cross-ref: layerx-eng-backend ─────────────────────────────────────────
  {
    id: "suzuki-takumi",
    initial: "鈴",
    gradient: G.royal,
    name: "鈴木 拓海",
    current_company: "LayerX",
    current_role: "バックエンドエンジニア",
    career_chain: [
      { label: "SIer エンジニア", is_current: false },
      { label: "LayerX バックエンド（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "L", gradient: CG.layerx, name: "LayerX" },
    ],
    themes: ["エンジニアキャリア設計", "大手→スタートアップ転職", "Go / バックエンド", "LayerX在籍経験"],
    dept: "エンジニア",
    industry: "FinTech",
    related_job_ids: ["layerx-eng-backend"],
    related_company_ids: ["layerx"],
  },

  // ── Cross-ref: smarthr-csm / SmartHR detail ───────────────────────────────
  {
    id: "hayashi-naomi",
    initial: "林",
    gradient: G.sky,
    name: "林 奈緒美",
    current_company: "SmartHR",
    current_role: "エンタープライズ CSM",
    career_chain: [
      { label: "SaaS企業 インサイドセールス", is_current: false },
      { label: "SmartHR エンタープライズ CSM（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "S", gradient: CG.smarthr, name: "SmartHR" },
    ],
    themes: ["カスタマーサクセスキャリア", "エンタープライズ営業 / CS", "SmartHR在籍経験"],
    dept: "カスタマーサクセス",
    industry: "HR Tech",
    related_job_ids: ["smarthr-csm"],
    related_company_ids: ["smarthr"],
  },

  // ── Cross-ref: smarthr-csm ────────────────────────────────────────────────
  {
    id: "hashimoto-takashi",
    initial: "橋",
    gradient: G.sky,
    name: "橋本 隆志",
    current_company: "SmartHR",
    current_role: "プロダクトマネージャー（CSM出身）",
    career_chain: [
      { label: "SmartHR CSM", is_current: false },
      { label: "SmartHR PdMへ異動（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "S", gradient: CG.smarthr, name: "SmartHR" },
    ],
    themes: ["CSM→PdM キャリアチェンジ", "職種・職域の変更", "SmartHR在籍経験"],
    dept: "PdM / PM",
    industry: "HR Tech",
    related_job_ids: ["smarthr-csm"],
    related_company_ids: ["smarthr"],
  },

  // ── Cross-ref: hubspot-solutions-engineer ─────────────────────────────────
  {
    id: "hayashi-seiichiro",
    initial: "林",
    gradient: G.sky,
    name: "林 誠一郎",
    current_company: "HubSpot Japan",
    current_role: "Solutions Engineer",
    career_chain: [
      { label: "国内SaaS プリセールス", is_current: false },
      { label: "HubSpot Japan SE（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "H", gradient: CG.hubspot, name: "HubSpot Japan" },
    ],
    themes: ["外資SaaSキャリア", "プリセールス / SE", "英語での仕事", "HubSpot在籍経験"],
    dept: "営業",
    industry: "SaaS / 外資",
    related_job_ids: ["hubspot-solutions-engineer"],
    related_company_ids: ["hubspot-japan"],
  },

  // ── Cross-ref: hubspot-solutions-engineer ─────────────────────────────────
  {
    id: "tamura-kyo",
    initial: "田",
    gradient: G.amber,
    name: "田村 京",
    current_company: "国内SaaS（非公開）",
    current_role: "プロダクトマネージャー",
    career_chain: [
      { label: "HubSpot Japan SE", is_current: false },
      { label: "国内SaaS PdMへ転職（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "H", gradient: CG.hubspot, name: "HubSpot Japan" },
    ],
    themes: ["外資→国内 転職", "SE→PdM キャリアチェンジ", "HubSpot在籍経験"],
    dept: "PdM / PM",
    industry: "SaaS / 外資",
    related_job_ids: ["hubspot-solutions-engineer"],
    related_company_ids: ["hubspot-japan"],
  },

  // ── Cross-ref: salesforce-ae-enterprise ───────────────────────────────────
  {
    id: "murakami-mariko",
    initial: "村",
    gradient: G.pink,
    name: "村上 真理子",
    current_company: "スタートアップ（非公開）",
    current_role: "CSO（最高営業責任者）",
    career_chain: [
      { label: "国内メーカー 法人営業", is_current: false },
      { label: "Salesforce Japan AE", is_current: false },
      { label: "スタートアップ CSO（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "S", gradient: CG.salesforce, name: "Salesforce Japan" },
    ],
    themes: ["外資トップセールス", "スタートアップ経営 / CxO", "エンタープライズ営業", "Salesforce在籍経験"],
    dept: "営業",
    industry: "SaaS / 外資",
    related_job_ids: ["salesforce-ae-enterprise"],
    related_company_ids: ["salesforce-japan"],
  },

  // ── Cross-ref: ubie-backend-engineer ──────────────────────────────────────
  {
    id: "honda-yoichi",
    initial: "本",
    gradient: G.green,
    name: "本田 陽一",
    current_company: "Ubie",
    current_role: "バックエンドエンジニア",
    career_chain: [
      { label: "Web系スタートアップ エンジニア", is_current: false },
      { label: "Ubie バックエンド（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "U", gradient: CG.ubie, name: "Ubie" },
    ],
    themes: ["ヘルスケア × テクノロジー", "ホラクラシー組織", "Go / バックエンド", "Ubie在籍経験"],
    dept: "エンジニア",
    industry: "HealthTech",
    related_job_ids: ["ubie-backend-engineer"],
    related_company_ids: ["ubie"],
  },

  // ── Cross-ref: ubie-backend-engineer ──────────────────────────────────────
  {
    id: "taniguchi-yusuke",
    initial: "谷",
    gradient: G.amber,
    name: "谷口 雄介",
    current_company: "医療系スタートアップ（非公開）",
    current_role: "CTO",
    career_chain: [
      { label: "Ubie バックエンドエンジニア", is_current: false },
      { label: "医療系スタートアップ CTO（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "U", gradient: CG.ubie, name: "Ubie" },
    ],
    themes: ["スタートアップ経営 / CxO", "週4日勤務・副業", "エンジニアのキャリア設計", "Ubie在籍経験"],
    dept: "エンジニア",
    industry: "HealthTech",
    related_job_ids: ["ubie-backend-engineer"],
    related_company_ids: ["ubie"],
  },

  // ── Cross-ref: freee-csm ──────────────────────────────────────────────────
  {
    id: "kobayashi-nana",
    initial: "小",
    gradient: G.teal,
    name: "小林 奈々",
    current_company: "freee",
    current_role: "SMB カスタマーサクセスマネージャー",
    career_chain: [
      { label: "会計事務所 スタッフ", is_current: false },
      { label: "freee SMB CSM（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "F", gradient: CG.freee, name: "freee" },
    ],
    themes: ["会計 / 経理 × SaaS", "カスタマーサクセスキャリア", "SMBビジネス", "freee在籍経験"],
    dept: "カスタマーサクセス",
    industry: "FinTech",
    related_job_ids: ["freee-csm"],
    related_company_ids: ["freee"],
  },

  // ── Cross-ref: freee-engineer-platform ────────────────────────────────────
  {
    id: "nonaka-kohei",
    initial: "野",
    gradient: G.royal,
    name: "野中 康平",
    current_company: "freee",
    current_role: "プラットフォームエンジニア",
    career_chain: [
      { label: "SIer インフラエンジニア", is_current: false },
      { label: "freee プラットフォームEng（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "F", gradient: CG.freee, name: "freee" },
    ],
    themes: ["インフラ / SRE キャリア", "Kubernetes / クラウド", "大手→スタートアップ転職", "freee在籍経験"],
    dept: "エンジニア",
    industry: "FinTech",
    related_job_ids: ["freee-engineer-platform"],
    related_company_ids: ["freee"],
  },

  // ── Cross-ref: sansan-pdm ─────────────────────────────────────────────────
  {
    id: "kato-shun",
    initial: "加",
    gradient: G.purple,
    name: "加藤 瞬",
    current_company: "Sansan",
    current_role: "プロダクトマネージャー",
    career_chain: [
      { label: "コンサルファーム", is_current: false },
      { label: "Sansan PdM（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "C", gradient: CG.consult, name: "コンサルファーム" },
      { initial: "S", gradient: CG.sansan, name: "Sansan" },
    ],
    themes: ["コンサル→PdMキャリア", "BtoB SaaS", "Sansan在籍経験"],
    dept: "PdM / PM",
    industry: "SaaS",
    related_job_ids: ["sansan-pdm"],
    related_company_ids: ["sansan"],
  },

  // ── Cross-ref: datadog-enterprise-ae ──────────────────────────────────────
  {
    id: "akasaka-yohei",
    initial: "赤",
    gradient: G.pink,
    name: "赤坂 洋平",
    current_company: "Datadog Japan",
    current_role: "エンタープライズ営業",
    career_chain: [
      { label: "国内IT商社 営業", is_current: false },
      { label: "Datadog Japan AE（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "D", gradient: CG.datadog, name: "Datadog Japan" },
    ],
    themes: ["外資ITセールス", "DevOps / オブザーバビリティ", "エンタープライズ営業", "Datadog在籍経験"],
    dept: "営業",
    industry: "SaaS / 外資",
    related_job_ids: ["datadog-enterprise-ae"],
    related_company_ids: ["datadog-japan"],
  },

  // ── Cross-ref: datadog-enterprise-ae ──────────────────────────────────────
  {
    id: "tachibana-ryosuke",
    initial: "橘",
    gradient: G.amber,
    name: "橘 涼介",
    current_company: "スタートアップ（非公開）",
    current_role: "CRO（最高収益責任者）",
    career_chain: [
      { label: "Datadog Japan AE", is_current: false },
      { label: "国内スタートアップ CRO（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "D", gradient: CG.datadog, name: "Datadog Japan" },
    ],
    themes: ["外資ITセールス → 経営", "スタートアップ経営 / CxO", "Datadog在籍経験"],
    dept: "営業",
    industry: "SaaS / 外資",
    related_job_ids: ["datadog-enterprise-ae"],
    related_company_ids: ["datadog-japan"],
  },

  // ── Cross-ref: notion-enterprise-cs ───────────────────────────────────────
  {
    id: "kitamura-rika",
    initial: "北",
    gradient: G.royal,
    name: "北村 梨花",
    current_company: "Notion Japan",
    current_role: "エンタープライズ CSM",
    career_chain: [
      { label: "国内SaaS カスタマーサクセス", is_current: false },
      { label: "Notion Japan エンタープライズ CSM（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "N", gradient: CG.notion, name: "Notion Japan" },
    ],
    themes: ["外資SaaSキャリア", "グローバルチームでの働き方", "英語での仕事", "Notion在籍経験"],
    dept: "カスタマーサクセス",
    industry: "SaaS / 外資",
    related_job_ids: ["notion-enterprise-cs"],
    related_company_ids: ["notion-japan"],
  },

  // ── Cross-ref: pksha-ml-engineer ──────────────────────────────────────────
  {
    id: "arai-takeshi",
    initial: "新",
    gradient: G.purple,
    name: "新井 武史",
    current_company: "PKSHA Technology",
    current_role: "機械学習エンジニア",
    career_chain: [
      { label: "大学院（機械学習専攻）", is_current: false },
      { label: "PKSHA Technology ML Eng（現職）", is_current: true },
    ],
    company_logos: [
      { initial: "P", gradient: CG.pksha, name: "PKSHA Technology" },
    ],
    themes: ["AI / LLM エンジニアキャリア", "アカデミア → 産業界", "研究×プロダクト", "PKSHA在籍経験"],
    dept: "エンジニア",
    industry: "AI / LLM",
    related_job_ids: ["pksha-ml-engineer"],
    related_company_ids: ["pksha-technology"],
  },
];

// ─── Filter constants ──────────────────────────────────────────────────────────

export const MENTOR_DEPTS = [
  "PdM / PM",
  "エンジニア",
  "営業",
  "カスタマーサクセス",
  "マーケティング",
  "経営 / CxO",
  "コーポレート",
];

export const MENTOR_INDUSTRIES = [
  "FinTech",
  "HR Tech",
  "SaaS",
  "SaaS / 外資",
  "HealthTech",
  "AI / LLM",
];

export const MENTOR_THEMES = [
  "キャリア設計",
  "転職・転職活動",
  "大手→スタートアップ転職",
  "外資→国内 転職",
  "スタートアップ経営 / CxO",
  "マネジメント・組織作り",
  "職種・職域の変更",
  "英語での仕事",
  "副業・独立",
];

// ─── Filter helpers ───────────────────────────────────────────────────────────

export type MentorFilterParams = {
  dept?: string;
  industry?: string;
  theme?: string;
  sort?: string;
};

export function filterMentors(mentors: Mentor[], params: MentorFilterParams): Mentor[] {
  let result = [...mentors];

  if (params.dept) {
    result = result.filter((m) => m.dept === params.dept);
  }
  if (params.industry) {
    result = result.filter((m) => m.industry === params.industry);
  }
  if (params.theme) {
    result = result.filter((m) =>
      m.themes.some((t) => t.includes(params.theme!))
    );
  }

  if (params.sort === "name") {
    result.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  return result;
}
