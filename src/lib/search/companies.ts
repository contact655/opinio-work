// src/lib/search/companies.ts
// 企業検索の抽象化レイヤー
//
// 事前調査結果（2026-05-17）:
//   employee_count: 大多数は純粋な数値文字列 ("20","50","80","150","300","500")
//                   一部 "1-10名" / "11-50名" 形式が混在 → アプリ側でレンジ判定
//   work_style:     ow_companies には remote_work_status カラム (on_site/hybrid/full_remote)
//                   work_style は ow_jobs 側のカラム → remote_work_status を使用
//   募集中判定:      ow_jobs.status = 'active' の存在チェック
//   is_published:   boolean NOT NULL — 31社 true / 3社 false
//
// 将来の拡張パス:
//   Phase 2: pg_trgm + trigram インデックス → ILIKE を similarity に差し替え
//   Phase 3: pgvector + embedding → embedding 類似度スコアを統合
//   Phase 4: LLM によるクエリ解釈 → params を前処理してからこの関数へ渡す

import { createClient } from "@/lib/supabase/server";
import type { CompanyForCarousel } from "@/types/genre";

// ── 型定義 ─────────────────────────────────────────────────────────────────────

export type SizeRange = "under-50" | "50-200" | "200-1000" | "1000-plus";
export type WorkStyleValue = "on_site" | "hybrid" | "full_remote";

export type CompanySearchParams = {
  q?: string;
  industry?: string;
  size?: SizeRange;
  workStyle?: WorkStyleValue;
  hiring?: boolean;
};

export type CompanySearchResult = {
  companies: CompanyForCarousel[];
  totalCount: number;
  appliedFilters: CompanySearchParams;
};

// ── 内部ユーティリティ ─────────────────────────────────────────────────────────

/**
 * employee_count テキストから数値を抽出する。
 * "300"   → 300 （純粋な数値文字列、大多数のパターン）
 * "1-10名" → 1   （範囲文字列の先頭数値）
 * null    → null
 */
function parseEmployeeCount(val: string | null): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  // 純粋な数値文字列 ("20", "300" 等)
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  // 範囲文字列 ("1-10名", "11-50名" 等) → 先頭の数字グループ
  const match = trimmed.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function matchesSize(employeeCount: string | null, size: SizeRange): boolean {
  const num = parseEmployeeCount(employeeCount);
  if (num === null) return false;
  switch (size) {
    case "under-50":   return num < 50;
    case "50-200":     return num >= 50 && num < 200;
    case "200-1000":   return num >= 200 && num < 1000;
    case "1000-plus":  return num >= 1000;
  }
}

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
  const supabase = createClient();

  // ── Step 1: Supabase クエリ（is_published=true + Supabase で処理可能な条件）
  let query = supabase
    .from("ow_companies")
    .select(
      "id, name, industry, funding_stage, employee_count, description, " +
      "accepting_casual_meetings, remote_work_status, logo_letter, logo_gradient, logo_url, updated_at"
    )
    .eq("is_published", true);

  // フリーワード: name / description / industry を ILIKE（大文字小文字無視）
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    query = query.or(
      `name.ilike.${pattern},description.ilike.${pattern},industry.ilike.${pattern}`
    );
  }

  // 業種フィルタ（完全一致）
  if (params.industry) {
    query = query.eq("industry", params.industry);
  }

  // 勤務形態フィルタ（ow_companies.remote_work_status）
  if (params.workStyle) {
    query = query.eq("remote_work_status", params.workStyle);
  }

  const { data: rawCompanies, error } = await query.order("name");
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyList: CompanyForCarousel[] = (rawCompanies ?? []) as any[];

  // ── Step 2: 全 active jobs の company_id セットを取得（hiring / job_count 両用）
  const companyIds = companyList.map((c) => c.id);
  const hiringSet = new Set<string>();
  const jobCountMap: Record<string, number> = {};

  if (companyIds.length > 0) {
    const { data: activeJobs } = await supabase
      .from("ow_jobs")
      .select("company_id")
      .in("company_id", companyIds)
      .eq("status", "active");

    (activeJobs ?? []).forEach((j: { company_id: string }) => {
      hiringSet.add(j.company_id);
      jobCountMap[j.company_id] = (jobCountMap[j.company_id] || 0) + 1;
    });
  }

  // ── Step 3: アプリ側フィルタ（employee_count レンジ、募集中フラグ）
  const companies: CompanyForCarousel[] = companyList
    .filter((c) => {
      if (params.size && !matchesSize(c.employee_count, params.size)) return false;
      if (params.hiring && !hiringSet.has(c.id)) return false;
      return true;
    })
    .map((c) => ({
      ...(c as CompanyForCarousel),
      job_count: jobCountMap[c.id] || 0,
    }));

  return {
    companies,
    totalCount: companies.length,
    appliedFilters: params,
  };
}

// ── 業種一覧取得（フィルタ選択肢用）────────────────────────────────────────────

/** 公開企業の distinct industry リスト（ドロップダウン選択肢） */
export async function fetchDistinctIndustries(): Promise<string[]> {
  const supabase = createClient();
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
