import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { filterListedCompanies } from "@/lib/companies/visibility";

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
  const domain = (searchParams.get("domain") ?? "").trim().toLowerCase();
  const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 10 : limitRaw), 50);

  if (q.length === 0 && domain.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createClient();

  // is_published = true のみ返す（RLS + 明示フィルター）
  // ⚠️ サジェストはディレクトリの軸。listing_status='draft' は出さない
  let query = filterListedCompanies(
    supabase
      .from("ow_companies")
      .select("id, name, brand_name, logo_url, industry, employee_count, url")
  )
    .order("name")
    .limit(limit);

  if (domain.length > 0) {
    // メールドメインで企業URLを検索（例: salesforce.com → %salesforce.com%）
    const safeDomain = domain.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.ilike("url", `%${safeDomain}%`);
  } else {
    // ILIKE wildcard エスケープ（% と _ はPostgreSQLのパターン文字）
    const safeQ = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(`name.ilike.%${safeQ}%,brand_name.ilike.%${safeQ}%`);
  }

  const { data: companies, error } = await query;

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
    url: (c as { url?: string | null }).url ?? null,
  }));

  return NextResponse.json({ results });
}
