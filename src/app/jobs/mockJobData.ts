
// ─── Types ────────────────────────────────────────────────────────────────────

export type SelectionStep = {
  step: string;
  name: string;
  meta: string;
};

export type BenefitRow = {
  key: string;
  value: string;
};

export type Job = {
  id: string;
  slug?: string | null;
  company_id: string;
  role: string;
  dept: string;              // ow_jobs.job_category（廃止予定のフリーテキスト）。職種判定には使わない
  role_category_id?: string; // ow_roles UUID。biz UI が更新しないため廃止予定
  /**
   * 職種の正。ow_job_roles の具体職種 ＋ その祖先まで展開した UUID 群。
   * 9大分類でも子階層でも `roleIds.includes(id)` の同じ判定で絞り込める。
   */
  roleIds?: string[];
  /** 標準職種名。ow_job_roles の primary（具体職種）の名前。無ければ null。
   *  ⚠️ 運営面（ADMIN）と、会社呼称との併記に使う。求職者面の表示は roleLabel を使うこと */
  roleName?: string | null;
  /** 求職者に見せる職種名。会社呼称 ?? 標準職種名（src/lib/jobs/roleLabel.ts）。
   *  ⚠️ 絞り込みには使わない。検索は roleIds のまま */
  roleLabel?: string | null;
  /** 会社呼称。論理削除済みなら null。roleName と併記したいときだけ使う */
  companyRoleName?: string | null;
  /** 未設定は null。**「正社員」に倒さない**（2026-08-07。値が無いことを、ある値に置き換えない） */
  employment_type: string | null;
  location: string;
  work_style: string;
  salary_min: number;
  salary_max: number;
  /* ── 待遇・労働環境（2026-09-02 追加）───────────────────────────
     ⚠️ **すべて任意。値が無ければ行ごと出さない**（「—」でも埋めない）。
     ⚠️ 福利厚生はここに無い。**福利厚生は企業単位で同じ**という判断（2026-09-02 / 柴さん）
        なので、求人ページも `ow_companies.benefits` を出す。**`ow_jobs.benefits` は【廃止】。** */
  /** 給与の補足（「※年棒制」「業績連動ボーナスあり」など）。金額の下に小さく出す */
  salary_note?: string | null;
  /** 勤務体系（「所定労働時間8時間、フレックスタイム制」など） */
  work_hours?: string | null;
  /** 休日・休暇（「完全週休2日制、有給休暇（10日〜）」など） */
  holidays?: string | null;
  /** 試用期間（「あり（3ヶ月）」など）。⚠️ 正は `probation_period`。`trial_period` は【廃止】 */
  probation_period?: string | null;
  experience: string;
  tags: string[];
  highlight: string;
  updated_days_ago: number;
  is_new: boolean;
  urgency: "open" | "hot";
  dept_members: number;
  member_avatars: { initial: string; gradient: string }[];
  // detail
  overview: string;
  main_tasks: string[];
  required_skills: string[];
  preferred_skills: string[];
  benefits: BenefitRow[];
  selection_flow: SelectionStep[];
  selection_note: string;
  related_article_title: string;
  related_article_excerpt: string;
  // SEO / structured data
  published_at?: string | null;
  expires_at?: string | null;
  // enrichment fields (Migration 147)
  why_hire?: string | null;
  team_composition?: string | null;
  first_90_days?: string | null;
  // 業態タグ (Migration 210)
  business_model?: string | null;
  // セールス職専用項目 (Migration 212)
  ote_min?: number | null;
  ote_max?: number | null;
  sales_segment?: string[] | null;
  sales_hunter_farmer?: string | null;
  incentive_note?: string | null;
  // 技術スタック (Migration 245)
  tech_stack?: string[] | null;
};

// ─── Mock jobs ────────────────────────────────────────────────────────────────

// ─── Filter constants ──────────────────────────────────────────────────────────

// ─── Filter helpers ───────────────────────────────────────────────────────────

