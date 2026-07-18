import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// 5分キャッシュ（公開データのみ返すためadminClientを使用）
export const revalidate = 300;

/**
 * GET /api/companies/preview
 * 求職者向けトップページ「注目企業」セクション用（最大9件）
 * articleCount: OPINIO取材済みバッジ用
 * memberCount: 登録済みメンバー数バッジ用
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ow_companies")
    .select(
      "id, slug, name, industry, phase, logo_gradient, logo_letter, logo_url, accepting_casual_meetings, employee_count"
    )
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(9);

  if (error) return NextResponse.json({ companies: [] });

  const companyIds = (data ?? []).map((row: Record<string, unknown>) => row.id as string);

  // 記事数（company_id が紐づいているもの）
  const articleCountMap: Record<string, number> = {};
  if (companyIds.length > 0) {
    const { data: articleRows } = await supabase
      .from("ow_articles")
      .select("company_id")
      .eq("is_published", true)
      .in("company_id", companyIds);
    for (const row of articleRows ?? []) {
      if (row.company_id) {
        articleCountMap[row.company_id] = (articleCountMap[row.company_id] ?? 0) + 1;
      }
    }
  }

  // 登録メンバー数（ow_experiences.company_id 経由）
  const memberCountMap: Record<string, Set<string>> = {};
  if (companyIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("ow_experiences")
      .select("company_id, user_id")
      .in("company_id", companyIds);
    for (const row of memberRows ?? []) {
      if (row.company_id && row.user_id) {
        if (!memberCountMap[row.company_id]) memberCountMap[row.company_id] = new Set();
        memberCountMap[row.company_id].add(row.user_id as string);
      }
    }
  }

  const companies = (data ?? []).map((row: Record<string, unknown>) => {
    const id = row.id as string;
    return {
      id,
      slug: (row.slug as string | null) ?? null,
      name: row.name as string,
      industry: row.industry as string | null,
      phase: row.phase as string | null,
      gradient: (row.logo_gradient as string | null) ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
      letter: (row.logo_letter as string | null) ?? ((row.name as string)?.charAt(0) ?? "?"),
      logoUrl: row.logo_url as string | null,
      acceptingMeeting: row.accepting_casual_meetings as boolean,
      employeeCount: row.employee_count as number | null,
      articleCount: articleCountMap[id] ?? 0,
      memberCount: memberCountMap[id]?.size ?? 0,
    };
  });

  return NextResponse.json({ companies });
}
