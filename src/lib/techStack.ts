export type TechStackCategory = {
  label: string;
  items: string[];
};

export const TECH_STACK_CATEGORIES: TechStackCategory[] = [
  { label: "言語", items: ["TypeScript", "JavaScript", "Go", "Python", "Ruby", "Java", "Kotlin", "Swift", "PHP", "Rust", "Scala"] },
  { label: "フロントエンド", items: ["React", "Next.js", "Vue.js", "Nuxt", "Svelte", "Flutter"] },
  { label: "バックエンド/FW", items: ["Node.js", "Rails", "Django", "FastAPI", "Spring", "Laravel", "NestJS"] },
  { label: "インフラ/クラウド", items: ["AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "PostgreSQL", "MySQL", "Redis"] },
  { label: "データ/AI", items: ["TensorFlow", "PyTorch", "BigQuery", "Snowflake"] },
];

