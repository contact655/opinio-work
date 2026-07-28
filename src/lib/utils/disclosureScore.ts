// 開示充実度スコア（100pt満点）
//
// 第1区分「企業が入力できる項目」: 45pt
//   tagline(5) + description(15) + 写真(10) + 福利厚生(5) + 求人あり(5) + 企業ストーリー(5)
//
// 第2区分「取材・投稿で埋まる項目」: 55pt
//   culture_description(10) + biz_model_types(10) + market_customer_size等(10)
//   + capital_type(5) + branch_locations等(5) + org_teams(5)
//   + ツール登録(5) + 給与データ3件以上(5)

import { SALARY_STATS_MIN } from "@/lib/constants/salary";

export type ScoreInput = {
  // 第1区分: 企業が入力できる項目 (45pt)
  tagline?: string | null;
  description?: string | null;
  photoCount?: number;
  benefitsCount?: number;
  hasPublishedJob?: boolean;
  hasPublishedStory?: boolean;
  // 第2区分: 取材・投稿で埋まる項目 (55pt)
  cultureDescription?: string | null;
  bizModelTypes?: string[] | null;
  marketCustomerSize?: string[] | null;
  capitalType?: string | null;
  branchLocations?: string[] | null;
  orgTeams?: unknown[] | null;
  toolCount?: number;
  salaryReportCount?: number;
};

export type ScoreBreakdown = {
  total: number;
  biz: number;       // /45
  interview: number; // /55
};

export function calcDisclosureScore(input: ScoreInput): ScoreBreakdown {
  // 第1区分
  const biz =
    (input.tagline ? 5 : 0) +
    (input.description ? 15 : 0) +
    (input.photoCount && input.photoCount >= 1 ? 10 : 0) +
    (input.benefitsCount && input.benefitsCount >= 1 ? 5 : 0) +
    (input.hasPublishedJob ? 5 : 0) +
    (input.hasPublishedStory ? 5 : 0);

  // 第2区分
  const interview =
    (input.cultureDescription ? 10 : 0) +
    (input.bizModelTypes && input.bizModelTypes.length > 0 ? 10 : 0) +
    (input.marketCustomerSize && input.marketCustomerSize.length > 0 ? 10 : 0) +
    (input.capitalType ? 5 : 0) +
    (input.branchLocations && input.branchLocations.length > 0 ? 5 : 0) +
    (input.orgTeams && input.orgTeams.length > 0 ? 5 : 0) +
    (input.toolCount && input.toolCount >= 1 ? 5 : 0) +
    (input.salaryReportCount && input.salaryReportCount >= SALARY_STATS_MIN ? 5 : 0);

  return { total: biz + interview, biz, interview };
}

export function scoreLabel(total: number): string {
  if (total >= 80) return "充実";
  if (total >= 50) return "良好";
  if (total >= 20) return "基本";
  return "未入力";
}

export function scoreColor(total: number): string {
  if (total >= 80) return "var(--success)";
  if (total >= 50) return "var(--royal)";
  if (total >= 20) return "var(--warm)";
  return "var(--ink-mute)";
}
