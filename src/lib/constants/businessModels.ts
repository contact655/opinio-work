// 業態タグ（プロダクト特性）マスタ定数
// 「どういう売り方・提供形態の会社か」を求職者が判断するための粒度で定義。
// 業界（ドメイン）とは独立した軸。ow_jobs.business_model / ow_companies.business_model で使用。

export const BUSINESS_MODELS = [
  { key: "product",      label: "自社プロダクト・SaaS",  desc: "SaaS、Webサービス、アプリ、プラットフォームなど自社開発のプロダクト・サービス" },
  { key: "consulting",   label: "コンサルティング",        desc: "課題解決型の知見・人材提供" },
  { key: "outsourcing",  label: "受託開発・SES",          desc: "顧客の要件に基づく開発・労働力提供" },
  { key: "si",           label: "SI・システム構築",        desc: "企業向け大規模システムの導入・構築" },
  { key: "other",        label: "その他",                 desc: "" },
] as const;

export type BusinessModelKey = (typeof BUSINESS_MODELS)[number]["key"];

export const BUSINESS_MODEL_LABELS: Record<BusinessModelKey, string> = Object.fromEntries(
  BUSINESS_MODELS.map((m) => [m.key, m.label])
) as Record<BusinessModelKey, string>;

