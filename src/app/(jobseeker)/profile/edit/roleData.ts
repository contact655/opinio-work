export type RoleCategory = {
  id: string;
  label: string;
  children: { id: string; label: string }[];
};

export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    id: "sales",
    label: "営業",
    children: [
      { id: "field_sales", label: "フィールドセールス" },
      { id: "enterprise_sales", label: "エンタープライズ営業" },
      { id: "inside_sales", label: "インサイドセールス" },
      { id: "sdr_bdr", label: "SDR / BDR" },
    ],
  },
  {
    id: "pm",
    label: "PdM / PM",
    children: [
      { id: "product_manager", label: "プロダクトマネージャー" },
      { id: "product_owner", label: "プロダクトオーナー" },
      { id: "pmm", label: "PMM（プロダクトマーケティングマネージャー）" },
    ],
  },
  {
    id: "cs",
    label: "カスタマーサクセス",
    children: [
      { id: "customer_success", label: "カスタマーサクセス" },
      { id: "customer_support", label: "カスタマーサポート" },
    ],
  },
  {
    id: "engineer",
    label: "エンジニア",
    children: [
      { id: "backend", label: "バックエンドエンジニア" },
      { id: "frontend", label: "フロントエンドエンジニア" },
      { id: "fullstack", label: "フルスタックエンジニア" },
      { id: "sre", label: "SRE / インフラエンジニア" },
    ],
  },
  {
    id: "marketing",
    label: "マーケティング",
    children: [
      { id: "digital_mkt", label: "デジタルマーケティング" },
      { id: "content_mkt", label: "コンテンツマーケティング" },
      { id: "event_mkt", label: "イベントマーケティング" },
    ],
  },
  {
    id: "exec",
    label: "経営・CxO",
    children: [
      { id: "ceo", label: "CEO" },
      { id: "coo", label: "COO" },
      { id: "cpo", label: "CPO" },
      { id: "cto", label: "CTO" },
      { id: "cfo", label: "CFO" },
    ],
  },
  {
    id: "other",
    label: "その他",
    children: [
      { id: "designer", label: "デザイナー" },
      { id: "biz_dev", label: "事業開発" },
      { id: "hrbp", label: "HRBP" },
      { id: "corporate", label: "コーポレート（HR/経理/法務）" },
      { id: "data_scientist", label: "データサイエンティスト" },
    ],
  },
];

export function searchRoles(query: string): RoleCategory[] {
  if (!query.trim()) return ROLE_CATEGORIES;
  const q = query.toLowerCase();
  return ROLE_CATEGORIES.map((cat) => ({
    ...cat,
    children: cat.children.filter((c) => c.label.toLowerCase().includes(q)),
  })).filter(
    (cat) =>
      cat.children.length > 0 || cat.label.toLowerCase().includes(q)
  );
}

export function getRoleLabelById(id: string): string {
  for (const cat of ROLE_CATEGORIES) {
    const child = cat.children.find((c) => c.id === id);
    if (child) return child.label;
  }
  return id;
}

export function getRoleCategoryLabel(roleId: string): string {
  for (const cat of ROLE_CATEGORIES) {
    if (cat.children.some((c) => c.id === roleId)) return cat.label;
  }
  return "";
}
