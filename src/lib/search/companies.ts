// src/lib/search/companies.ts
// 企業検索の抽象化レイヤー
//
// 事前調査結果（2026-05-17）:
//   employee_count: 大多数は純粋な数値文字列 ("20","50","80","150","300","500")
//                   一部 "1-10名" / "11-50名" 形式が混在 → アプリ側でレンジ判定
//   work_style:     ow_companies には remote_work_status カラム (on_site/hybrid/full_remote)
//                   work_style は ow_jobs 側のカラム → remote_work_status を使用
//   募集中判定:      ow_jobs.status = 'published' の存在チェック（Migration 113以降）
//   is_published:   boolean NOT NULL — 31社 true / 3社 false
//
// 将来の拡張パス:
//   Phase 2: pg_trgm + trigram インデックス → ILIKE を similarity に差し替え
//   Phase 3: pgvector + embedding → embedding 類似度スコアを統合
//   Phase 4: LLM によるクエリ解釈 → params を前処理してからこの関数へ渡す

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { CompanyForCarousel } from "@/types/genre";

// ── 型定義 ─────────────────────────────────────────────────────────────────────

export type WorkStyleValue = "on_site" | "hybrid" | "full_remote";

export type CompanySearchParams = {
  q?: string;
  phase?: string;     // フェーズフィルタ（例: "シリーズA", "上場"）
  workStyle?: WorkStyleValue;
  hiring?: boolean;
  location?: string;  // 都道府県フィルタ（例: "東京都", "大阪府"）
  industry?: string;  // 業種フィルタ（例: "HR Tech", "FinTech/SaaS"）
  // DB側ページネーション（hiring フィルターなしの場合のみ有効）
  limit?: number;
  offset?: number;
};

export type CompanySearchResult = {
  companies: CompanyForCarousel[];
  totalCount: number;       // フィルター適用後の総件数
  appliedFilters: CompanySearchParams;
};

// ── メイン検索関数（将来の差し替えポイント）────────────────────────────────────

/**
 * 企業を検索する。
 *
 * 内部実装: Supabase + ILIKE（ローンチ時 34社規模で十分高速）
 * 将来: `searchCompanies` のシグネチャを変えずに内部を差し替え可能
 */
export async function searchCompanies(
  params: CompanySearchParams
): Promise<CompanySearchResult> {
  const supabase = createPublicClient();

  // ── DB側ページネーションを使うか判定
  // hiring フィルターはアプリ側で処理するため、DB ページネーションと併用不可
  const useDbPagination = !params.hiring && params.limit !== undefined;

  // ── フィルター条件を組み立てるヘルパー
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (params.q?.trim()) {
      const pattern = `%${params.q.trim()}%`;
      q = q.or(`name.ilike.${pattern},description.ilike.${pattern},industry.ilike.${pattern}`);
    }
    if (params.phase)     q = q.eq("phase", params.phase);
    if (params.workStyle) q = q.eq("remote_work_status", params.workStyle);
    if (params.location)  q = q.eq("location", params.location);
    if (params.industry)  q = q.eq("industry", params.industry);
    return q;
  }

  // ── Step 1a: 総件数取得（DB ページネーション時のみ）
  let totalCount = 0;
  if (useDbPagination) {
    const countQuery = applyFilters(
      supabase.from("ow_companies").select("id", { count: "exact", head: true }).eq("is_published", true)
    );
    const { count } = await countQuery;
    totalCount = count ?? 0;
  }

  // ── Step 1b: データ取得
  let dataQuery = applyFilters(
    supabase
      .from("ow_companies")
      .select(
        "id, name, name_en, tagline, industry, funding_stage:phase, employee_count, description, " +
        "accepting_casual_meetings, remote_work_status, location, logo_letter, logo_gradient, logo_url, updated_at, " +
        "current_member_count, obog_count"
      )
      .eq("is_published", true)
  ).order("name");

  // DB ページネーション適用
  if (useDbPagination) {
    const offset = params.offset ?? 0;
    const limit  = params.limit!;
    dataQuery = dataQuery.range(offset, offset + limit - 1);
  }

  const { data: rawCompanies, error } = await dataQuery;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyList: CompanyForCarousel[] = (rawCompanies ?? []) as any[];

  // ── Step 2: 求人件数 + 記事件数 + hiring フラグ（表示企業分のみ）
  const companyIds = companyList.map((c) => c.id);
  const hiringSet  = new Set<string>();
  const jobCountMap: Record<string, number> = {};
  const articleCountMap: Record<string, number> = {};

  if (companyIds.length > 0) {
    const [activeJobsResult, articlesResult] = await Promise.all([
      supabase
        .from("ow_jobs")
        .select("company_id")
        .in("company_id", companyIds)
        .in("status", ["published", "active"]),
      supabase
        .from("ow_articles")
        .select("company_id")
        .in("company_id", companyIds)
        .eq("is_published", true),
    ]);

    (activeJobsResult.data ?? []).forEach((j: { company_id: string }) => {
      hiringSet.add(j.company_id);
      jobCountMap[j.company_id] = (jobCountMap[j.company_id] || 0) + 1;
    });

    (articlesResult.data ?? []).forEach((a: { company_id: string | null }) => {
      if (a.company_id) {
        articleCountMap[a.company_id] = (articleCountMap[a.company_id] || 0) + 1;
      }
    });
  }

  // ── Step 3: アプリ側フィルタ（hiring のみ、DB ページネーション時は不要）
  const companies: CompanyForCarousel[] = companyList
    .filter((c) => {
      if (params.hiring && !hiringSet.has(c.id)) return false;
      return true;
    })
    .map((c) => ({
      ...(c as CompanyForCarousel),
      job_count: jobCountMap[c.id] || 0,
      article_count: articleCountMap[c.id] || 0,
    }));

  return {
    companies,
    totalCount: useDbPagination ? totalCount : companies.length,
    appliedFilters: params,
  };
}

// ── 業種一覧取得（フィルタ選択肢用）────────────────────────────────────────────

/** 公開企業の distinct industry リスト（ドロップダウン選択肢） */
export async function fetchDistinctIndustries(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("ow_companies")
    .select("industry")
    .eq("is_published", true)
    .not("industry", "is", null)
    .order("industry");

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data ?? []) {
    if (row.industry && !seen.has(row.industry)) {
      seen.add(row.industry);
      result.push(row.industry);
    }
  }
  return result;
}

// 北から南順の都道府県リスト（表示順制御用）
const PREFECTURE_ORDER = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

/** 公開企業の distinct location リスト（北から南順） — 5分間キャッシュ */
export const fetchDistinctLocations = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("ow_companies")
      .select("location")
      .eq("is_published", true)
      .not("location", "is", null);

    const seen = new Set<string>();
    for (const row of data ?? []) {
      if (row.location) seen.add(row.location);
    }

    const ordered = PREFECTURE_ORDER.filter((p) => seen.has(p));
    seen.forEach((p) => { if (!PREFECTURE_ORDER.includes(p)) ordered.push(p); });
    return ordered;
  },
  ["distinct-locations"],
  { revalidate: 300 }
);
