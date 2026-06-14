export const INDUSTRY_GROUPS = [
  {
    key: "sales",
    label: "セールス・CRM",
    values: ["Sales Tech", "CRM", "CRM/SaaS", "MAツール", "顧客コミュニケーション"],
  },
  {
    key: "hr",
    label: "HR Tech",
    values: ["HR Tech"],
  },
  {
    key: "fintech",
    label: "FinTech・会計",
    values: ["FinTech/SaaS", "経費精算", "財務・ERP", "財務会計", "調達管理", "電子署名"],
  },
  {
    key: "ai",
    label: "AI・Medical",
    values: ["AI Tech", "Medical AI"],
  },
  {
    key: "infra",
    label: "インフラ・セキュリティ",
    values: [
      "クラウドインフラ", "セキュリティ", "データベース", "データストリーミング",
      "データベース・ERP", "ネットワーキング", "インシデント管理",
      "SaaS / オブザーバビリティ", "ハードウェア", "半導体",
    ],
  },
  {
    key: "productivity",
    label: "生産性・コラボ",
    values: [
      "プロジェクト管理", "ワークフロー自動化", "ファイル共有",
      "コラボレーション", "コンテンツ管理", "デジタルアダプション",
    ],
  },
  {
    key: "devtools",
    label: "DevTools",
    values: ["DevTools", "API管理", "コミュニケーションAPI"],
  },
  {
    key: "other",
    label: "その他",
    values: ["ConTech", "SNS / メタバース", "クリエイティブ", "モビリティ", "エンタープライズIT"],
  },
] as const;

export type IndustryGroupKey = (typeof INDUSTRY_GROUPS)[number]["key"];

export function resolveIndustryFilter(industryParam: string): string[] | null {
  const group = INDUSTRY_GROUPS.find((g) => g.key === industryParam);
  return group ? [...group.values] : null;
}
