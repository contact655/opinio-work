export const INDUSTRY_GROUPS = [
  { key: "ai",        label: "AI・データ",        values: ["AI・データ"] },
  { key: "security",  label: "セキュリティ",        values: ["セキュリティ"] },
  { key: "infra",     label: "クラウドインフラ",     values: ["クラウドインフラ"] },
  { key: "hr",        label: "HR・人材",            values: ["HR・人材"] },
  { key: "fintech",   label: "FinTech",             values: ["FinTech"] },
  { key: "crm",       label: "CRM・営業支援",        values: ["CRM・営業支援"] },
  { key: "collab",    label: "コラボレーション",      values: ["コラボレーション"] },
  { key: "marketing", label: "マーケティング",        values: ["マーケティング"] },
  { key: "hardware",  label: "ハードウェア・半導体",  values: ["ハードウェア・半導体"] },
  { key: "healthcare",label: "ヘルスケア",            values: ["ヘルスケア"] },
  { key: "ec",        label: "コマース・EC",          values: ["コマース・EC"] },
] as const;


export function resolveIndustryFilter(industryParam: string): string[] | null {
  const group = INDUSTRY_GROUPS.find((g) => g.key === industryParam);
  return group ? [...group.values] : null;
}
