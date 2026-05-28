// src/lib/genres.ts
// ジャンル別企業データ取得
// 段階：genres-feature Phase B
//
// SELECT カラムは実 ow_companies スキーマに合わせて調整済み:
//   series → funding_stage
//   accepting_interview → accepting_casual_meetings
//   work_style → remote_work_status
//   employee_count は text 型のまま使用
//
// クエリ最適化（2026-05-25）:
//   旧: 1(genres) + N×2(companies+jobs per genre) = N*2+1 クエリ
//   新: 3クエリ（genres / company_genres一括 / jobs一括）

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { GenreWithCompanies, CompanyForCarousel } from "@/types/genre";

/** カルーセル1行あたりの最大表示社数 */
const CAROUSEL_LIMIT = 9;

/**
 * フェーズフィルター（CompanySearchBar）と重複するジャンルを除外するスラッグ一覧。
 * 「業種・タイプ」と「資金調達ステージ」の軸を分離するための措置。
 * DBのジャンルレコードは残したまま、表示レイヤーで非表示にする。
 */
const PHASE_GENRE_SLUGS = ["early-stage", "ipo-ready"];

async function _fetchGenresWithCompanies(): Promise<GenreWithCompanies[]> {
  const supabase = createPublicClient();

  // ── Query 1: アクティブなジャンルを表示順で取得 ──────────────────────────────
  const { data: genres, error: genresError } = await supabase
    .from("ow_genres")
    .select("id, slug, name, description, display_order, is_active")
    .eq("is_active", true)
    .order("display_order");

  if (genresError || !genres || genres.length === 0) {
    console.error("Failed to fetch genres:", genresError);
    return [];
  }

  // フェーズ系ジャンルを除外（フェーズはフィルターチップで管理）
  const filteredGenres = genres.filter(
    (g) => !PHASE_GENRE_SLUGS.includes(g.slug) && !PHASE_GENRE_SLUGS.includes(g.name)
  );

  const genreIds = filteredGenres.map((g) => g.id);

  // ── Query 2: 全ジャンルの company-genre リンクを一括取得 ─────────────────────
  const { data: allLinks } = await supabase
    .from("ow_company_genres")
    .select(
      `
      genre_id,
      company_id,
      created_at,
      ow_companies!inner (
        id, name, tagline, industry, funding_stage, employee_count,
        description, accepting_casual_meetings, remote_work_status,
        location, logo_letter, logo_gradient, logo_url, updated_at,
        current_member_count, obog_count
      )
    `
    )
    .in("genre_id", genreIds)
    .eq("is_human_approved", true)
    .order("created_at", { ascending: false });

  // ── Query 3: 全対象企業の募集中求人を一括取得 ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCompanyIds = Array.from(new Set((allLinks ?? []).map((l: any) => l.ow_companies.id)));
  const jobCountMap: Record<string, number> = {};

  if (allCompanyIds.length > 0) {
    const { data: jobRows } = await supabase
      .from("ow_jobs")
      .select("company_id")
      .in("company_id", allCompanyIds)
      .in("status", ["published", "active"]);

    (jobRows ?? []).forEach((row: { company_id: string }) => {
      jobCountMap[row.company_id] = (jobCountMap[row.company_id] || 0) + 1;
    });
  }

  // ── アセンブル: ジャンルごとにリンクを仕分け ──────────────────────────────────
  // genre_id → links のマップを構築
  const linksByGenre = new Map<string, typeof allLinks>();
  for (const link of allLinks ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gid = (link as any).genre_id as string;
    if (!linksByGenre.has(gid)) linksByGenre.set(gid, []);
    linksByGenre.get(gid)!.push(link);
  }

  return filteredGenres.map((genre) => {
    const links = linksByGenre.get(genre.id) ?? [];
    const limited = links.slice(0, CAROUSEL_LIMIT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companies: CompanyForCarousel[] = limited.map((link: any) => ({
      ...(link.ow_companies as CompanyForCarousel),
      job_count: jobCountMap[link.ow_companies.id] || 0,
    }));

    return {
      ...genre,
      companies,
      total_count: links.length,
    };
  });
}

// 5分間キャッシュ（公開データ。企業追加後は自動で反映される）
export const fetchGenresWithCompanies = unstable_cache(
  _fetchGenresWithCompanies,
  ["genres-with-companies"],
  { revalidate: 300 }
);
