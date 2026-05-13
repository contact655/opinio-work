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
  name: string;
  industry: string | null;
  funding_stage: string | null;
  employee_count: string | null;       // ow_companies.employee_count は text 型
  description: string | null;
  accepting_casual_meetings: boolean;  // 面談OKバッジ用
  remote_work_status: string | null;   // 働き方バッジ用
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
  updated_at: string;
};

export type GenreWithCompanies = Genre & {
  companies: CompanyForCarousel[];
  total_count: number;
};
