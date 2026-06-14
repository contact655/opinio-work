// src/lib/search/companies.ts
import { resolveIndustryFilter } from "./industryGroups";
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
  foreign?: boolean;  // 外資系のみ表示
  sort?: string;      // "newest" | "jobs" | "employees" | "phase"
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
  // hiring / foreign フィルターはアプリ側で処理するため、DB ページネーションと併用不可
  const useDbPagination = !params.hiring && !params.foreign && params.phase !== "外資系" && params.limit !== undefined;

  // ── フィルター条件を組み立てるヘルパー
  // #14: スペース区切りで AND 検索（例: "SaaS PM" → name.ilike.%SaaS% AND name.ilike.%PM%）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (params.q?.trim()) {
      const words = params.q.trim().split(/\s+/).filter(Boolean);
      for (const word of words) {
        const p = `%${word}%`;
        q = q.or(`name.ilike.${p},description.ilike.${p},industry.ilike.${p},tagline.ilike.${p}`);
      }
    }
    if (params.phase && params.phase !== "外資系") q = q.eq("phase", params.phase);
    if (params.workStyle) q = q.eq("remote_work_status", params.workStyle);
    if (params.location)  q = q.eq("location", params.location);
    if (params.industry) {
      const groupValues = resolveIndustryFilter(params.industry);
      if (groupValues) {
        q = q.in("industry", groupValues);
      } else {
        q = q.ilike("industry", `%${params.industry}%`);
      }
    }
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
  // #3: company_features を SELECT に追加
  // #10: sort パラメータに応じて ORDER BY を切り替え（server-side sort）
  const orderCol = params.sort === "employees" ? "employee_count" : "updated_at";
  const orderAsc = false; // 全ソート DESC
  // phase sort はクライアント側で処理（後述）
  const isPhaseSort = params.sort === "phase";

  let dataQuery = applyFilters(
    supabase
      .from("ow_companies")
      .select(
        "id, name, name_en, tagline, industry, funding_stage:phase, employee_count, description, " +
        "accepting_casual_meetings, remote_work_status, location, logo_letter, logo_gradient, logo_url, updated_at, " +
        "current_member_count, obog_count, avg_salary, company_features"
      )
      .eq("is_published", true)
  ).order(orderCol, { ascending: orderAsc });

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

  // #2: 求人タイトルマップ（最大2件/企業）
  const jobTitlesMap: Record<string, string[]> = {};

  if (companyIds.length > 0) {
    const [activeJobsResult, articlesResult] = await Promise.all([
      // #2: title カラムも取得
      supabase
        .from("ow_jobs")
        .select("company_id, title")
        .in("company_id", companyIds)
        .in("status", ["published", "active"]),
      supabase
        .from("ow_articles")
        .select("company_id")
        .in("company_id", companyIds)
        .eq("is_published", true),
    ]);

    (activeJobsResult.data ?? []).forEach((j: { company_id: string; title?: string }) => {
      hiringSet.add(j.company_id);
      jobCountMap[j.company_id] = (jobCountMap[j.company_id] || 0) + 1;
      // #2: 最大2件のタイトルを記録
      if (j.title) {
        if (!jobTitlesMap[j.company_id]) jobTitlesMap[j.company_id] = [];
        if (jobTitlesMap[j.company_id].length < 2) {
          jobTitlesMap[j.company_id].push(j.title);
        }
      }
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
      // #2 求人タイトル / #3 カルチャータグ
      top_job_titles: jobTitlesMap[c.id] || [],
      company_features: Array.isArray((c as CompanyForCarousel).company_features)
        ? (c as CompanyForCarousel).company_features
        : [],
    }));

  // client-side: 外資系フィルター（foreign param または phase="外資系"）
  let filteredCompanies = companies;
  if (params.foreign || params.phase === "外資系") {
    filteredCompanies = filteredCompanies.filter((c) => {
      const name = (c as { name?: string }).name ?? "";
      const nameEn = (c as { name_en?: string | null }).name_en;
      return (
        name.includes(" Japan") ||
        name.includes(" Inc") ||
        (!name.includes("株式会社") &&
          !name.includes("合同会社") &&
          !name.includes("有限会社") &&
          !name.includes("株式") &&
          !!nameEn)
      );
    });
    totalCount = filteredCompanies.length;
  }

  // client-side: フェーズ順ソート
  if (isPhaseSort) {
    const PHASE_ORDER: Record<string, number> = {
      "プレシード": 0, "ブートストラップ": 1, "シード": 2,
      "シリーズA": 3, "シリーズB": 4, "シリーズC": 5,
      "シリーズD以降": 6, "シリーズD": 6, "IPO準備中": 7, "上場": 8,
    };
    filteredCompanies = [...filteredCompanies].sort((a, b) => {
      const phaseA = (a as { funding_stage?: string }).funding_stage ?? (a as { phase?: string }).phase ?? "";
      const phaseB = (b as { funding_stage?: string }).funding_stage ?? (b as { phase?: string }).phase ?? "";
      const ao = PHASE_ORDER[phaseA] ?? 99;
      const bo = PHASE_ORDER[phaseB] ?? 99;
      return ao - bo;
    });
  }

  return {
    companies: filteredCompanies,
    totalCount: useDbPagination ? totalCount : filteredCompanies.length,
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

function normalizePrefecture(loc: string): string {
  // 東京都品川区 → 東京都 / 大阪府港区 → 大阪府 / 北海道札幌市 → 北海道
  const m = loc.match(/^(東京都|大阪府|京都府|北海道|.+?[都道府県])/);
  return m ? m[1] : loc;
}

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
      if (row.location) seen.add(normalizePrefecture(row.location));
    }

    const ordered = PREFECTURE_ORDER.filter((p) => seen.has(p));
    seen.forEach((p) => { if (!PREFECTURE_ORDER.includes(p)) ordered.push(p); });
    return ordered;
  },
  ["distinct-locations"],
  { revalidate: 300 }
);
