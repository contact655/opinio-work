// 開示充実度スコア（0-100）計算ロジック

export type ScoreInput = {
  // リアル開示 (40pt)
  realityNotFor?: string | null;
  realityTurnoverReasons?: string[] | null;
  realityOnboardingGaps?: string | null;
  // 数値開示 (20pt)
  avgOvertimeHours?: string | null;
  paidLeaveRate?: number | string | null;
  // プロフィール充実度 (40pt)
  tagline?: string | null;
  aboutMarkdown?: string | null;
  whyJoin?: string | null;
  fitPositives?: string[] | null;
  fitNegatives?: string[] | null;
};

export type ScoreBreakdown = {
  total: number;
  reality: number;    // /40
  numbers: number;    // /20
  profile: number;    // /40
};

export function calcDisclosureScore(input: ScoreInput): ScoreBreakdown {
  let reality = 0;
  if (input.realityNotFor?.trim()) reality += 15;
  if (input.realityTurnoverReasons && input.realityTurnoverReasons.length > 0) reality += 15;
  if (input.realityOnboardingGaps?.trim()) reality += 10;

  let numbers = 0;
  if (input.avgOvertimeHours?.trim()) numbers += 10;
  const leaveRate = typeof input.paidLeaveRate === "string"
    ? parseInt(input.paidLeaveRate, 10)
    : input.paidLeaveRate;
  if (leaveRate != null && !isNaN(leaveRate as number)) numbers += 10;

  let profile = 0;
  if (input.tagline?.trim()) profile += 5;
  if (input.aboutMarkdown?.trim()) profile += 10;
  if (input.whyJoin?.trim()) profile += 10;
  if (input.fitPositives && input.fitPositives.length > 0) profile += 5;
  if (input.fitNegatives && input.fitNegatives.length > 0) profile += 10;

  return {
    reality,
    numbers,
    profile,
    total: reality + numbers + profile,
  };
}

export function scoreLabel(total: number): string {
  if (total >= 80) return "充実";
  if (total >= 50) return "基本";
  if (total >= 20) return "入門";
  return "未開示";
}

export function scoreColor(total: number): string {
  if (total >= 80) return "var(--success)";
  if (total >= 50) return "var(--royal)";
  if (total >= 20) return "var(--warm)";
  return "var(--ink-mute)";
}
