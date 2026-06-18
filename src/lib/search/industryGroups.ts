export const INDUSTRY_GROUPS = [
  {
    key: "sales",
    label: "セールス・CRM",
    values: ["Sales Tech", "CRM", "CRM/SaaS", "MAツール", "顧客コミュニケーション"],
  },
  {
    key: "hr",
    label: "HR・人材",
    values: ["HR Tech"],
  },
  {
    key: "fintech",
    label: "FinTech・経理",
    values: ["FinTech/SaaS", "経費精算", "財務・ERP", "財務会計", "調達管理", "電子署名"],
  },
  {
    key: "data",
    label: "データ・分析",
    values: [
      "AI Tech", "データストリーミング", "データベース", "データベース・ERP",
      "SaaS / オブザーバビリティ", "インシデント管理",
    ],
  },
  {
    key: "security",
    label: "セキュリティ",
    values: ["セキュリティ", "ネットワーキング"],
  },
  {
    key: "infra",
    label: "クラウド・インフラ",
    values: ["クラウドインフラ", "ハードウェア", "半導体"],
  },
  {
    key: "productivity",
    label: "業務・コラボ",
    values: [
      "プロジェクト管理", "ワークフロー自動化", "ファイル共有",
      "コラボレーション", "コンテンツ管理", "デジタルアダプション", "エンタープライズIT",
    ],
  },
  {
    key: "devtools",
    label: "DevTools・API",
    values: ["DevTools", "API管理", "コミュニケーションAPI"],
  },
  {
    key: "healthcare",
    label: "ヘルスケア",
    values: ["Medical AI", "ヘルスケア", "MedTech"],
  },
  {
    key: "other",
    label: "その他",
    values: ["ConTech", "SNS / メタバース", "クリエイティブ", "モビリティ"],
  },
] as const;

export type IndustryGroupKey = (typeof INDUSTRY_GROUPS)[number]["key"];

export function resolveIndustryFilter(industryParam: string): string[] | null {
  const group = INDUSTRY_GROUPS.find((g) => g.key === industryParam);
  return group ? [...group.values] : null;
}
