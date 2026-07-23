import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/onboarding/companies/search
 *
 * オンボーディング専用の企業検索（認証必須）
 * 未公開企業も含めて検索する（is_published フィルターなし）
 * name + brand_name の OR 検索
 */
export async function GET(req: NextRequest) {
  // 認証チェック
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const safeQ = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const admin = createAdminClient();

  const { data: companies, error } = await admin
    .from("ow_companies")
    .select("id, name, brand_name, industry, phase, is_published")
    .or(`name.ilike.%${safeQ}%,brand_name.ilike.%${safeQ}%`)
    .order("is_published", { ascending: false })
    .order("name")
    .limit(8);

  if (error) {
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    results: (companies ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      brand_name: c.brand_name ?? null,
      industry: c.industry ?? null,
      phase: c.phase ?? null,
    })),
  });
}
