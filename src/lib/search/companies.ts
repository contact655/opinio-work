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
  phase?: string;      // フェーズフィルタ（例: "シリーズA", "上場"）
  workStyle?: WorkStyleValue;
  hiring?: boolean;
  location?: string;   // 都道府県フィルタ（例: "東京都", "大阪府"）
  industry?: string;   // 業種フィルタ（例: "HR Tech", "FinTech/SaaS"）
  foreign?: boolean;   // 外資系のみ表示
  salaryMin?: number;  // 平均年収下限（万円）
  sort?: string;       // "newest" | "jobs" | "employees" | "salary"
  // DB側ページネーション（hiring フィルターなしの場合のみ有効）
  limit?: number;
  offset?: number;
};

export type CompanySearchResult = {
  companies: CompanyForCarousel[];
  totalCount: number;       // フィルター適用後の総件数
  appliedFilters: CompanySearchParams;
};

// ── フェーズフィルター: 日本語 UI 値 → DB 値（英語/日本語混在）のマッピング ───
const PHASE_FILTER_MAP: Record<string, string[]> = {
  "成長ステージ":    ["シード", "seed", "シリーズA", "series-a", "series_a", "シリーズB", "series-b", "series_b", "シリーズC", "series-c", "series_c"],
  "プレシード":      ["プレシード", "pre-seed", "preseed", "pre_seed"],
  "ブートストラップ": ["ブートストラップ", "bootstrap"],
  "シード":          ["シード", "seed"],
  "シリーズA":       ["シリーズA", "series-a", "series_a"],
  "シリーズB":       ["シリーズB", "series-b", "series_b"],
  "シリーズC":       ["シリーズC", "series-c", "series_c"],
  "シリーズD以降":   ["シリーズD以降", "シリーズD", "series-d", "series_d"],
  "IPO準備中":       ["IPO準備中", "ipo"],
  "上場":            ["上場", "listed"],
  "ユニコーン":      ["ユニコーン", "unicorn"],
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
  // hiring / foreign / salaryMin フィルターはアプリ側で処理するため、DB ページネーションと併用不可
  const useDbPagination = !params.hiring && !params.foreign && !params.salaryMin && params.phase !== "外資系" && params.limit !== undefined;

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
    if (params.phase && params.phase !== "外資系") {
      const dbValues = PHASE_FILTER_MAP[params.phase] ?? [params.phase];
      q = q.in("phase", dbValues);
    }
    if (params.workStyle)  q = q.eq("remote_work_status", params.workStyle);
    if (params.location) {
      // branch_locations 配列にも対応（大阪府 → 大阪, 愛知県 → 名古屋|愛知 等）
      // PostgREST injection 対策: メタ文字を除去してからフィルター文字列に埋め込む
      const safeLocation = params.location.replace(/[(),"\\]/g, "");
      if (safeLocation) {
        const extraKeys = PREF_TO_BRANCH_KEYS[params.location];
        if (extraKeys) {
          // 既知の都道府県: PREF_TO_BRANCH_KEYS の値のみ使用（ユーザー入力を埋め込まない）
          const branchConds = extraKeys.map((k) => `branch_locations.cs.{"${k}"}`).join(",");
          q = q.or(`location.ilike.%${safeLocation}%,${branchConds}`);
        } else {
          // 未知の値: ilike のみ（branch_locations フィルターは使わない）
          q = q.ilike("location", `%${safeLocation}%`);
        }
      }
    }
    if (params.salaryMin)  q = q.gte("avg_salary", params.salaryMin * 10000);
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

  // ── Step 1: データ取得 + 総件数を1クエリで同時取得（count: "exact"）
  // 旧: COUNT クエリ → await → DATA クエリ（2 hop）
  // 新: DATA クエリ + count: "exact" で1 hop に統合
  const orderCol = params.sort === "employees" ? "employee_count"
                : params.sort === "salary"    ? "avg_salary"
                : "updated_at";
  const orderAsc = false;

  let dataQuery = applyFilters(
    supabase
      .from("ow_companies")
      .select(
        "id, name, name_en, tagline, industry, funding_stage:phase, employee_count, description, is_foreign, " +
        "accepting_casual_meetings, remote_work_status, location, branch_locations, logo_letter, logo_gradient, logo_url, updated_at, " +
        "current_member_count, obog_count, avg_salary, company_features, reality_disclosure",
        useDbPagination ? { count: "exact" } : undefined
      )
      .eq("is_published", true)
  ).order(orderCol, { ascending: orderAsc });

  if (useDbPagination) {
    const offset = params.offset ?? 0;
    const limit  = params.limit!;
    dataQuery = dataQuery.range(offset, offset + limit - 1);
  }

  const { data: rawCompanies, count: rawCount, error } = await dataQuery;
  if (error) throw error;
  let totalCount = rawCount ?? 0;

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
      if (params.salaryMin) {
        const sal = (c as { avg_salary?: number | string | null }).avg_salary;
        const salNum = typeof sal === "number" ? sal : typeof sal === "string" ? parseInt(sal.replace(/[^0-9]/g, ""), 10) : 0;
        if (!salNum || salNum < params.salaryMin * 10000) return false;
      }
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

  // client-side: 外資系フィルター（is_foreign カラムを使用）
  let filteredCompanies = companies;
  if (params.foreign || params.phase === "外資系") {
    filteredCompanies = filteredCompanies.filter((c) => {
      return (c as { is_foreign?: boolean }).is_foreign === true;
    });
    totalCount = filteredCompanies.length;
  }

  return {
    companies: filteredCompanies,
    totalCount: useDbPagination ? totalCount : filteredCompanies.length,
    appliedFilters: params,
  };
}

// ── 業種一覧取得（フィルタ選択肢用）────────────────────────────────────────────

/** 公開企業の distinct industry リスト（ドロップダウン選択肢）— 5分間キャッシュ */
export const fetchDistinctIndustries = unstable_cache(
  async (): Promise<string[]> => {
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
  },
  ["distinct-industries"],
  { revalidate: 300 }
);

// branch_locations の値（都道府県サフィックスなし）→ 正式な都道府県名 マッピング
const BRANCH_TO_PREF: Record<string, string> = {
  "大阪": "大阪府", "京都": "京都府", "兵庫": "兵庫県",
  "神奈川": "神奈川県", "埼玉": "埼玉県", "千葉": "千葉県",
  "広島": "広島県", "福岡": "福岡県", "宮城": "宮城県",
  "北海道": "北海道", "名古屋": "愛知県", "愛知": "愛知県",
};

// 都道府県名 → branch_locations で使われるキー群（複数ある場合）
const PREF_TO_BRANCH_KEYS: Record<string, string[]> = {
  "愛知県": ["愛知", "名古屋"],
};

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

/** 公開企業の distinct location リスト（北から南順、branch_locations も含む） — 5分間キャッシュ */
export const fetchDistinctLocations = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("ow_companies")
      .select("location, branch_locations")
      .eq("is_published", true);

    const seen = new Set<string>();
    for (const row of data ?? []) {
      // メイン所在地
      if (row.location) seen.add(normalizePrefecture(row.location));
      // 支社・拠点
      for (const branch of (row.branch_locations as string[] | null) ?? []) {
        const pref = BRANCH_TO_PREF[branch] ?? (branch.match(/[都道府県]$/) ? branch : null);
        if (pref) seen.add(pref);
      }
    }

    const ordered = PREFECTURE_ORDER.filter((p) => seen.has(p));
    seen.forEach((p) => { if (!PREFECTURE_ORDER.includes(p)) ordered.push(p); });
    return ordered;
  },
  ["distinct-locations"],
  { revalidate: 300 }
);
