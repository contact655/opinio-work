// src/lib/genres.ts
// ジャンル別企業データ取得
// 段階：genres-feature Phase B
//
// SELECT カラムは実 ow_companies スキーマに合わせて調整済み:
//   series → funding_stage
//   accepting_interview → accepting_casual_meetings
//   work_style → remote_work_status
//   employee_count は text 型のまま使用

import { createClient } from "@/lib/supabase/server";
import type { GenreWithCompanies, CompanyForCarousel } from "@/types/genre";

/** カルーセル1行あたりの最大表示社数 */
const CAROUSEL_LIMIT = 9;

export async function fetchGenresWithCompanies(): Promise<GenreWithCompanies[]> {
  const supabase = createClient();

  // アクティブなジャンルを表示順で取得
  const { data: genres, error: genresError } = await supabase
    .from("ow_genres")
    .select("id, slug, name, description, display_order, is_active")
    .eq("is_active", true)
    .order("display_order");

  if (genresError || !genres) {
    console.error("Failed to fetch genres:", genresError);
    return [];
  }

  // 各ジャンルに紐づく企業を並列取得
  const results = await Promise.all(
    genres.map(async (genre) => {
      const { data: links, count } = await supabase
        .from("ow_company_genres")
        .select(
          `
          company_id,
          ow_companies!inner (
            id, name, industry, funding_stage, employee_count,
            description, accepting_casual_meetings, remote_work_status,
            logo_letter, logo_gradient, updated_at
          )
        `,
          { count: "exact" }
        )
        .eq("genre_id", genre.id)
        .eq("is_human_approved", true)
        .order("created_at", { ascending: false })
        .limit(CAROUSEL_LIMIT);

      const companies: CompanyForCarousel[] = (links ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (link: any) => ({
          ...(link.ow_companies as CompanyForCarousel),
        })
      );

      return {
        ...genre,
        companies,
        total_count: count ?? 0,
      };
    })
  );

  return results;
}
