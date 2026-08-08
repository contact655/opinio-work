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
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyForCarousel } from "@/types/genre";
import { PHASE_FILTER_MAP, availablePhaseOptions, type PhaseOption } from "@/lib/constants/phase";

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
  // hiring / foreign / salaryMin / クライアントソート フィルターはアプリ側で処理するため、DB ページネーションと併用不可
  const clientSideSort = params.sort === "jobs" || params.sort === "salary" || params.sort === "disclosure";
  const useDbPagination = !params.hiring && !params.foreign && !params.salaryMin && params.phase !== "外資系" && !clientSideSort && params.limit !== undefined;

  // ── フィルター条件を組み立てるヘルパー
  // #14: スペース区切りで AND 検索（例: "SaaS PM" → name.ilike.%SaaS% AND name.ilike.%PM%）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (params.q?.trim()) {
      const words = params.q.trim().split(/\s+/).filter(Boolean);
      for (const word of words) {
        // PostgREST injection 対策: .or() 文字列に埋め込む前にメタ文字を除去
        const safeWord = word.replace(/[(),"\\]/g, "");
        if (!safeWord) continue;
        const p = `%${safeWord}%`;
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
    // salaryMin は計算値（求人ごとの中央値平均）でアプリ側フィルタリングするため DB フィルターは不要
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
  const orderCol = params.sort === "employees" ? "employee_count" : "updated_at";
  const orderAsc = false;

  let dataQuery = applyFilters(
    supabase
      .from("ow_companies")
      .select(
        "id, slug, name, name_en, tagline, industry, funding_stage:phase, employee_count, description, is_foreign, " +
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

  // 求人ごとの平均中央値（万円）を企業単位で集計
  const calcAvgSalaryMap: Record<string, number> = {};

  // ライブ社員数集計（案X）— is_test=false かつ visibility!='private'
  // current/obog の定義:
  //   現役 = is_current=true
  //   OB   = is_current=false かつ 同社で is_current=true を持たない
  const liveCurrentCountMap: Record<string, number> = {};
  const liveObogCountMap: Record<string, number> = {};

  if (companyIds.length > 0) {
    const [activeJobsResult, articlesResult, expResult] = await Promise.all([
      supabase
        .from("ow_jobs")
        .select("company_id, title, salary_min, salary_max")
        .in("company_id", companyIds)
        .in("status", ["published", "active"]),
      supabase
        .from("ow_articles")
        .select("company_id")
        .in("company_id", companyIds)
        .eq("is_published", true),
      // login_only ユーザーも集計に含めるため adminSupabase を使用（RLS バイパス）
      createAdminClient()
        .from("ow_experiences")
        .select("company_id, user_id, is_current, ow_users!inner(id, is_test, visibility)")
        .in("company_id", companyIds),
    ]);

    // 集計: 企業ごとに現役 user_id セット / OB候補 user_id セットを構築
    const currentSets  = new Map<string, Set<string>>();
    const alumniSets   = new Map<string, Set<string>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (expResult.data ?? []) as any[]) {
      const u = e.ow_users as { id: string; is_test: boolean | null; visibility: string | null } | null;
      if (!u || u.is_test === true || u.visibility === "private") continue;
      const cid = e.company_id as string;
      const uid = e.user_id as string;
      if (e.is_current) {
        if (!currentSets.has(cid)) currentSets.set(cid, new Set());
        currentSets.get(cid)!.add(uid);
      } else {
        if (!alumniSets.has(cid)) alumniSets.set(cid, new Set());
        alumniSets.get(cid)!.add(uid);
      }
    }
    companyIds.forEach((cid) => {
      const curr = currentSets.get(cid) ?? new Set<string>();
      const alum = alumniSets.get(cid) ?? new Set<string>();
      liveCurrentCountMap[cid] = curr.size;
      let obogCount = 0;
      alum.forEach((uid) => { if (!curr.has(uid)) obogCount++; });
      liveObogCountMap[cid] = obogCount;
    });

    // 企業ごとに求人中央値のリストを集める
    const salaryMediansMap: Record<string, number[]> = {};

    (activeJobsResult.data ?? []).forEach((j: { company_id: string; title?: string; salary_min?: number | null; salary_max?: number | null }) => {
      hiringSet.add(j.company_id);
      jobCountMap[j.company_id] = (jobCountMap[j.company_id] || 0) + 1;
      // #2: 最大2件のタイトルを記録
      if (j.title) {
        if (!jobTitlesMap[j.company_id]) jobTitlesMap[j.company_id] = [];
        if (jobTitlesMap[j.company_id].length < 2) {
          jobTitlesMap[j.company_id].push(j.title);
        }
      }
      // 中央値 = (min + max) / 2（両方ある場合のみ）
      const mn = j.salary_min ?? 0;
      const mx = j.salary_max ?? 0;
      if (mn > 0 && mx > 0) {
        if (!salaryMediansMap[j.company_id]) salaryMediansMap[j.company_id] = [];
        salaryMediansMap[j.company_id].push((mn + mx) / 2);
      }
    });

    // 中央値リストの平均を計算（万円単位に丸める）
    for (const [cid, medians] of Object.entries(salaryMediansMap)) {
      const avg = medians.reduce((s, v) => s + v, 0) / medians.length;
      calcAvgSalaryMap[cid] = Math.round(avg);
    }

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
        // 計算値（万円）を優先、なければ手動設定の avg_salary にフォールバック
        const calcSal = calcAvgSalaryMap[c.id] ?? null;
        if (calcSal !== null) {
          if (calcSal < params.salaryMin) return false;
        } else {
          const sal = (c as { avg_salary?: number | string | null }).avg_salary;
          const salNum = typeof sal === "number" ? sal / 10000 : typeof sal === "string" ? parseInt(sal.replace(/[^0-9]/g, ""), 10) / 10000 : 0;
          if (!salNum || salNum < params.salaryMin) return false;
        }
      }
      return true;
    })
    .map((c) => ({
      ...(c as CompanyForCarousel),
      job_count: jobCountMap[c.id] || 0,
      article_count: articleCountMap[c.id] || 0,
      calc_avg_salary_man: calcAvgSalaryMap[c.id] ?? null,
      // #2 求人タイトル / #3 カルチャータグ
      top_job_titles: jobTitlesMap[c.id] || [],
      company_features: Array.isArray((c as CompanyForCarousel).company_features)
        ? (c as CompanyForCarousel).company_features
        : [],
      // 案X: ライブ集計値（静的カラムを廃止し、これを正値とする）
      live_current_count: liveCurrentCountMap[c.id] ?? 0,
      live_obog_count: liveObogCountMap[c.id] ?? 0,
    }));

  // client-side: 外資系フィルター（is_foreign カラムを使用）
  let filteredCompanies = companies;
  if (params.foreign || params.phase === "外資系") {
    filteredCompanies = filteredCompanies.filter((c) => {
      return (c as { is_foreign?: boolean }).is_foreign === true;
    });
    totalCount = filteredCompanies.length;
  }

  // client-side ソート（jobs / salary / disclosure）
  if (params.sort === "jobs") {
    filteredCompanies = [...filteredCompanies].sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0));
  } else if (params.sort === "salary") {
    const parseSalary = (c: CompanyForCarousel) => {
      // 計算値（万円）を優先
      if ((c as { calc_avg_salary_man?: number | null }).calc_avg_salary_man) {
        return (c as { calc_avg_salary_man: number }).calc_avg_salary_man;
      }
      const s = (c as { avg_salary?: string | number | null }).avg_salary;
      if (!s) return 0;
      const n = parseInt(String(s).replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? 0 : n / 10000;
    };
    filteredCompanies = [...filteredCompanies].sort((a, b) => parseSalary(b) - parseSalary(a));
  } else if (params.sort === "disclosure") {
    const disclosureScore = (c: CompanyForCarousel) => {
      let score = 0;
      const s = (c as { avg_salary?: string | number | null }).avg_salary;
      if (s && String(s).replace(/[^0-9]/g, "")) score += 2;
      if ((c.article_count ?? 0) > 0) score += 3;
      if ((c.job_count ?? 0) > 0) score += 1;
      if (Array.isArray(c.company_features) && c.company_features.length > 0) score += 1;
      if ((c.live_current_count ?? c.current_member_count ?? 0) > 0) score += 2;
      if ((c.live_obog_count ?? c.obog_count ?? 0) > 0) score += 1;
      return score;
    };
    filteredCompanies = [...filteredCompanies].sort((a, b) => disclosureScore(b) - disclosureScore(a));
  }

  return {
    companies: filteredCompanies,
    totalCount: useDbPagination ? totalCount : filteredCompanies.length,
    appliedFilters: params,
  };
}

// ── 業種一覧取得（フィルタ選択肢用）────────────────────────────────────────────

/** 公開企業の distinct industry リスト（ドロップダウン選択肢）— 5分間キャッシュ */
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

/**
 * 公開企業に**実在する** phase から、出してよいフェーズ選択肢を返す — 5分間キャッシュ。
 *
 * ⚠️ 0件の選択肢を出さないため（2026-08-08）。以前は11段を固定で出しており、
 *    実データに1社も無い「プレシード」「ブートストラップ」「IPO準備中」等も並んでいた。
 *    逆に non_listed（4社）は選択肢が無く絞れなかった。
 */
export const fetchAvailablePhases = unstable_cache(
  async (): Promise<PhaseOption[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("ow_companies")
      .select("phase")
      .eq("is_published", true);
    if (error) {
      console.error("[fetchAvailablePhases]", error.message);
      return [];
    }
    return availablePhaseOptions((data ?? []).map((r) => r.phase as string | null));
  },
  ["available-phases"],
  { revalidate: 300 }
);

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
