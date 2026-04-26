/**
 * Fix 5: Role category taxonomy
 * Maps free-text job_category values to a structured 3-tier hierarchy:
 *   group → category
 */

export type RoleCategory = {
  /** display label */
  label: string;
  /** group label (e.g. ビジネス系) */
  group: "ビジネス系" | "技術系" | "企画系";
  /**
   * Predicate used to test whether a job's job_category string belongs to this category.
   * Should match the same intent across noisy free-text values.
   */
  match: (jobCategory: string) => boolean;
};

const norm = (s: string) => (s || "").toLowerCase();

export const ROLE_CATEGORIES: RoleCategory[] = [
  // ─── ビジネス系 ───
  {
    label: "営業",
    group: "ビジネス系",
    match: (c) => {
      const s = norm(c);
      return (
        c.includes("営業") ||
        c.includes("セールス") ||
        s.includes("sales") ||
        c.includes("フィールドセールス") ||
        c.includes("インサイド") ||
        c.includes("BDR") ||
        s.includes("ae") ||
        c.includes("アカウントエグゼクティブ")
      );
    },
  },
  {
    label: "カスタマーサクセス",
    group: "ビジネス系",
    match: (c) => {
      const s = norm(c);
      return (
        c.includes("カスタマー") ||
        c.includes("CS") ||
        s.includes("customer success") ||
        s.includes("csm") ||
        c.includes("サポート")
      );
    },
  },
  {
    label: "マーケティング",
    group: "ビジネス系",
    match: (c) => {
      const s = norm(c);
      return c.includes("マーケ") || s.includes("marketing");
    },
  },
  {
    label: "BizDev",
    group: "ビジネス系",
    match: (c) => {
      const s = norm(c);
      return c.includes("事業開発") || s.includes("bizdev") || c.includes("ビジネス開発");
    },
  },

  // ─── 技術系 ───
  {
    label: "エンジニア",
    group: "技術系",
    match: (c) => {
      const s = norm(c);
      return (
        c.includes("エンジニア") ||
        s.includes("engineer") ||
        s.includes("developer") ||
        c.includes("開発") ||
        c.includes("SRE") ||
        c.includes("インフラ") ||
        c.includes("バックエンド") ||
        c.includes("フロントエンド") ||
        c.includes("モバイル") ||
        c.includes("データ")
      );
    },
  },
  {
    label: "デザイナー",
    group: "技術系",
    match: (c) => {
      const s = norm(c);
      return c.includes("デザイナー") || s.includes("designer") || s.includes("ux") || s.includes("ui");
    },
  },
  {
    label: "AI/ML",
    group: "技術系",
    match: (c) => {
      const s = norm(c);
      return s.includes("ai") || s.includes("ml") || c.includes("機械学習");
    },
  },

  // ─── 企画系 ───
  {
    label: "PdM",
    group: "企画系",
    match: (c) => {
      const s = norm(c);
      return (
        s.includes("pdm") ||
        s.includes("product manager") ||
        c.includes("プロダクト") ||
        c.includes("プロダクトマネージャー")
      );
    },
  },
  {
    label: "PjM",
    group: "企画系",
    match: (c) => {
      const s = norm(c);
      return (
        s.includes("pjm") ||
        s.includes("project manager") ||
        c.includes("プロジェクトマネージャー") ||
        c.includes("PM")
      );
    },
  },
  {
    label: "経営企画",
    group: "企画系",
    match: (c) => c.includes("経営") || c.includes("企画"),
  },
];

/**
 * Build groups for UI rendering.
 */
export function getRoleCategoryGroups(): { group: string; categories: RoleCategory[] }[] {
  const groupOrder: ("ビジネス系" | "技術系" | "企画系")[] = ["ビジネス系", "技術系", "企画系"];
  return groupOrder.map((group) => ({
    group,
    categories: ROLE_CATEGORIES.filter((c) => c.group === group),
  }));
}

export function matchesRoleCategory(jobCategory: string | null | undefined, label: string): boolean {
  if (label === "すべて") return true;
  if (!jobCategory) return false;
  const cat = ROLE_CATEGORIES.find((c) => c.label === label);
  if (!cat) return false;
  return cat.match(jobCategory);
}

/** Just the labels (used as chip values) */
export const ROLE_CATEGORY_LABELS: string[] = ROLE_CATEGORIES.map((c) => c.label);
