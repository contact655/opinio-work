// src/types/genre.ts
// 企業ジャンル別カルーセル機能の型定義
// 段階：genres-feature Phase B
//
// フィールド調整（事前確認結果に基づく実 ow_companies スキーマ対応）:
//   series             → funding_stage (text | null)
//   employee_count     → employee_count (text | null)  ※DBはtext型
//   accepting_interview → accepting_casual_meetings (boolean)
//   work_style         → remote_work_status (text | null)

export type Genre = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export type CompanyForCarousel = {
  id: string;
  slug?: string | null;             // URL-safe slug（例: "salesforce"）。null の場合は id で代替
  name: string;
  name_en?: string | null;             // 英語社名（ブランド表記用）
  tagline: string | null;              // 企業キャッチコピー（1行）
  industry: string | null;
  funding_stage: string | null;
  employee_count: string | null;       // ow_companies.employee_count は text 型
  description: string | null;
  accepting_casual_meetings: boolean;  // 面談OKバッジ用（旧フラグ、後方互換）
  jobs_public: boolean;                // 求人・面談バッジの実際の表示制御（engagement_status 連動）
  remote_work_status: string | null;   // 働き方バッジ用
  location: string | null;            // 所在地（都道府県）
  branch_locations?: string[] | null; // 東京以外の日本国内支社（都道府県名）
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
  updated_at: string;
  job_count: number;            // ow_jobs.status='published' のCOUNT（実数）
  /** @deprecated 非正規化静的カラム。参照箇所は live_current_count / live_obog_count に移行済み */
  current_member_count: number;
  /** @deprecated 非正規化静的カラム。参照箇所は live_current_count / live_obog_count に移行済み */
  obog_count: number;
  /** ライブ集計: is_test=false かつ visibility!='private' の現役社員数 */
  live_current_count?: number;
  /** ライブ集計: is_test=false かつ visibility!='private' の OB/OG 数（現役兼任者は除く） */
  live_obog_count?: number;
  article_count?: number;       // OPINIO 取材記事数
  // 追加情報（カード充実化）
  avg_salary?: string | null;
  calc_avg_salary_man?: number | null;  // 求人(salary_min+salary_max)/2 の平均（万円）
  founded_year?: number | null;
  fit_positives?: string[] | null;
  sort_order?: number | null;
  // 14項目改善で追加
  company_features?: string[] | null;  // #3 カルチャー・特徴タグ
  top_job_titles?: string[] | null;    // #2 求人ポジション名（最大2件）
  /* ⚠️ review_avg / review_count は 2026-08-07 に削除した。
     参照元の ow_company_reviews がこのプロジェクトに存在せず、
     常に null で「表示されないUI」が残っていたため。 */
};

export type GenreWithCompanies = Genre & {
  companies: CompanyForCarousel[];
  total_count: number;
};
