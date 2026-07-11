export const RATING_AXES = [
  { key: "rating_culture",      label: "社風・文化",   avg_key: "avg_culture" },
  { key: "rating_growth",       label: "成長機会",     avg_key: "avg_growth" },
  { key: "rating_wlb",          label: "WLB",          avg_key: "avg_wlb" },
  { key: "rating_compensation", label: "報酬水準",     avg_key: "avg_compensation" },
  { key: "rating_leadership",   label: "リーダーシップ", avg_key: "avg_leadership" },
  { key: "rating_business",     label: "ビジネス展望", avg_key: "avg_business" },
  { key: "rating_welfare",      label: "福利厚生",     avg_key: "avg_welfare" },
] as const;

export type RatingAxisKey = (typeof RATING_AXES)[number]["key"];
export type SummaryAvgKey = (typeof RATING_AXES)[number]["avg_key"];
