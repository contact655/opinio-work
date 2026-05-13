import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();

  // status: 'active' のみ返す（draft は除外）
  const { data: companies, error } = await admin
    .from("ow_companies")
    .select("id, name, logo_url, industry, employee_count")
    .eq("status", "active")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(limit);

  if (error) {
    console.error("[GET /api/companies/search] query failed:", error.message);
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500 }
    );
  }

  if (!companies || companies.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // 各企業の admin_count を取得
  const companyIds = companies.map((c) => c.id);
  const { data: adminRows } = await admin
    .from("ow_company_admins")
    .select("company_id")
    .in("company_id", companyIds)
    .not("user_id", "is", null);

  const adminCountMap: Record<string, number> = {};
  for (const row of adminRows ?? []) {
    adminCountMap[row.company_id] = (adminCountMap[row.company_id] ?? 0) + 1;
  }

  const results = companies.map((c) => ({
    id: c.id,
    name: c.name,
    logo_url: c.logo_url ?? null,
    industry: c.industry ?? null,
    admin_count: adminCountMap[c.id] ?? 0,
    employee_count: c.employee_count ?? null,
  }));

  return NextResponse.json({ results });
}
