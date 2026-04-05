// ─── Company Stats & Badge Utilities ─────────────────
// Extracted from CompanyExplorer for reuse across components

export type Stat = { value: string; label: string; highlight?: boolean };

// ─── Constants ──────────────────────────────────────

export const GAISHI_KEYWORDS = [
  "Google", "Amazon", "Microsoft", "Salesforce", "Meta", "Apple",
  "Oracle", "SAP", "IBM", "Cisco", "Adobe",
];

// サービスリリース日 — この日以前に作成された企業にはNEWをつけない
export const LAUNCH_DATE = new Date("2026-04-04");

// ─── Parsers ────────────────────────────────────────

export function parseEmployeeCount(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/(\d[\d,]*)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
}

export function parseFounded(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

// ─── Company Classification ─────────────────────────

export function isGaishi(c: any): boolean {
  return GAISHI_KEYWORDS.some(
    (k) => c.name?.includes(k) || c.name_en?.includes(k)
  );
}

export function isStartup(c: any): boolean {
  const count = c.employees_jp || parseEmployeeCount(c.employee_count);
  const founded = c.founded_year || parseFounded(c.founded_at);
  const currentYear = new Date().getFullYear();
  return (
    (founded > 0 && currentYear - founded <= 5) ||
    (count > 0 && count <= 100) ||
    ["シード", "シリーズA", "シリーズB", "early", "seed"].some(
      (p) => c.phase?.includes(p)
    )
  );
}

export function isListed(c: any): boolean {
  const count = c.employees_jp || parseEmployeeCount(c.employee_count);
  return (
    count >= 300 ||
    c.is_listed === true ||
    c.phase?.includes("上場") ||
    c.phase?.includes("listed")
  );
}

// ─── Badge Logic ────────────────────────────────────

export function checkIsNew(c: any): boolean {
  if (!c.created_at) return false;
  const created = new Date(c.created_at);
  return (
    created > LAUNCH_DATE &&
    created > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
}

export function checkIsFeatured(c: any): boolean {
  return (c.ow_jobs?.length || 0) >= 4;
}

// ─── Auto Stats（「非公開」を絶対に表示しない） ─────

export function getAutoStats(c: any): Stat[] {
  const empJp = c.employees_jp || parseEmployeeCount(c.employee_count);
  const foundedYear = c.founded_year || parseFounded(c.founded_at);
  const jobCount = c.ow_jobs?.length || 0;
  const stats: Stat[] = [];

  // 社員数（最優先）
  if (empJp > 0) {
    stats.push({ value: `${empJp.toLocaleString()}名`, label: "社員数" });
  }

  // 上場・フェーズ
  if (c.stock_market) {
    stats.push({ value: c.stock_market, label: "上場市場" });
  } else if (c.is_listed === true || c.phase?.includes("上場")) {
    stats.push({ value: "上場", label: "市場" });
  } else if (c.phase) {
    stats.push({ value: c.phase, label: "フェーズ" });
  }

  // 3つ目: 優先度順で最初に見つかった項目
  const thirdCandidates = [
    c.avg_salary ? { value: c.avg_salary, label: "平均年収" } : null,
    c.remote_rate ? { value: `${c.remote_rate}%`, label: "リモート率", highlight: true } : null,
    (c.funding_total && c.funding_total !== "非公開") ? { value: c.funding_total, label: "調達額" } : null,
    foundedYear > 0 ? { value: `${foundedYear}年`, label: "設立" } : null,
    jobCount > 0 ? { value: `${jobCount}件`, label: "求人数" } : null,
    c.industry ? { value: c.industry, label: "業種" } : null,
  ];

  for (const item of thirdCandidates) {
    if (item && stats.length < 3) {
      stats.push(item);
      break;
    }
  }

  return stats.slice(0, 3);
}

// ─── Sanitize（「非公開」を絶対に出さない） ─────────

/**
 * 値が有効な表示用テキストかチェック。null / undefined / "非公開" / 空文字は null を返す
 */
export function sanitizeValue(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === "非公開" || s === "N/A" || s === "-") return null;
  return s;
}

// ─── Company Badges ─────────────────────────────────

export type Badge = { label: string; color: string; bg: string };

export function getCompanyBadges(c: any): Badge[] {
  const badges: Badge[] = [];

  if (checkIsNew(c)) {
    badges.push({ label: "NEW", color: "#1D9E75", bg: "#E1F5EE" });
  }
  if (isGaishi(c)) {
    badges.push({ label: "外資系", color: "#2563EB", bg: "#EFF6FF" });
  }
  if (isStartup(c)) {
    badges.push({ label: "スタートアップ", color: "#7C3AED", bg: "#F5F3FF" });
  }
  if (isListed(c)) {
    badges.push({ label: "上場企業", color: "#D97706", bg: "#FFFBEB" });
  }
  if (checkIsFeatured(c)) {
    badges.push({ label: "注目", color: "#DC2626", bg: "#FEF2F2" });
  }

  return badges;
}

// ─── Job Categories ─────────────────────────────────

export function getJobCategories(c: any): string[] {
  const jobs = c.ow_jobs || [];
  const cats = new Set<string>();
  jobs.forEach((j: any) => {
    if (j.job_category) cats.add(j.job_category);
  });
  return Array.from(cats);
}
