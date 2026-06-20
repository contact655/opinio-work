export const INDUSTRY_GROUPS = [
  { key: "ai",        label: "AI・データ",        values: ["AI・データ"] },
  { key: "security",  label: "セキュリティ",        values: ["セキュリティ"] },
  { key: "infra",     label: "クラウドインフラ",     values: ["クラウドインフラ"] },
  { key: "hr",        label: "HR Tech",            values: ["HR Tech"] },
  { key: "fintech",   label: "FinTech",             values: ["FinTech"] },
  { key: "crm",       label: "CRM・営業支援",        values: ["CRM・営業支援"] },
  { key: "collab",    label: "コラボレーション",      values: ["コラボレーション"] },
  { key: "marketing", label: "マーケティング",        values: ["マーケティング"] },
  { key: "hardware",  label: "ハードウェア・半導体",  values: ["ハードウェア・半導体"] },
  { key: "it",        label: "ITサービス",           values: ["ITサービス"] },
  { key: "healthcare",label: "Healthcare",           values: ["Healthcare"] },
  { key: "contech",   label: "ConTech",              values: ["ConTech"] },
  { key: "other",     label: "その他",               values: ["その他"] },
] as const;

export type IndustryGroupKey = (typeof INDUSTRY_GROUPS)[number]["key"];

export function resolveIndustryFilter(industryParam: string): string[] | null {
  const group = INDUSTRY_GROUPS.find((g) => g.key === industryParam);
  return group ? [...group.values] : null;
}
