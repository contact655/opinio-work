import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/companies/search
 *
 * 企業名サジェスト（認証不要・公開エンドポイント）
 * Phase 2 Sprint 1 — 経歴登録時 / 企業作成時の重複チェック用
 *
 * クエリパラメータ:
 *   q     - 検索文字列（2文字以上推奨）
 *   limit - 最大件数（デフォルト 10、最大 50）
 *
 * レスポンス:
 *   { results: [{ id, name, logo_url, industry, admin_count, employee_count }] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 10 : limitRaw), 50);

  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createClient();

  // is_published = true のみ返す（RLS + 明示フィルター）
  const { data: companies, error } = await supabase
    .from("ow_companies")
    .select("id, name, logo_url, industry, employee_count")
    .eq("is_published", true)
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(limit);

  if (error) {
    console.error("[GET /api/companies/search] query failed");
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500 }
    );
  }

  if (!companies || companies.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results = companies.map((c) => ({
    id: c.id,
    name: c.name,
    logo_url: c.logo_url ?? null,
    industry: c.industry ?? null,
    employee_count: c.employee_count ?? null,
  }));

  return NextResponse.json({ results });
}
